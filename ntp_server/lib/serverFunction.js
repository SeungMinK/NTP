require("dotenv").config();
const Crypto = require("crypto-js"); // 대칭키 암호화에 사용
const Bcrypt = require("bcrypt"); //비대칭키 암호화에 사용
const key = process.env.USER_ENCRYPT_KEY; //Const로 변경 안되게, 대칭키 암호화에 사용되는키
const saltOrRounds = 10; //비대칭 암호화 횟수, 높을수록 보안성은 증가하지만 속도가 오래걸림
const getConnection = require("./db");
const exec_sql = require("../public/js/exec_sql");
const schedule = require("node-schedule");
var Storage = require("node-storage");
var store = new Storage("store/token/file");
var request = require("request");
var NodeRSA = require("node-rsa");
const fs = require("fs");


//공통함수들 정의
function toYYYY_MM_DD(arg) {
    if (arg != null) return arg.slice(0, 4) + "-" + arg.slice(4, 6) + "-" + arg.slice(6, 8);
    else return "1900-01-01";
}

function toYYYYMMDD(arg) {
    if (arg != null) return arg.slice(0, 4) + arg.slice(5, 7) + arg.slice(8, 10);
    else return "19000101";
}

//any type property를 string type으로 변환
function toString(arg) {
    return arg + "";
}

//비밀번호 초기화 난수만들기
function rand(min = 1, max = 10) {
    var length = 8,
        charset = process.env.CHARSET,
        retVal = "";
    for (var i = 0, n = charset.length; i < length; ++i) {
        if (i == 1) retVal += "@";
        if (i == 2) retVal += "X";
        if (i == 4) retVal += "6";
        if (i == 7) retVal += "a";
        retVal += charset.charAt(Math.floor(Math.random() * n));
    }

    return retVal;
}

//암호화_입력할때마다 값이 다름(레인보우 테이블 방지)_복호화는 정상작동
function encrypt(data) {
    return Crypto.AES.encrypt(data, key).toString();
}
//복호화
function decrypt(data) {
    return Crypto.AES.decrypt(data, key).toString(Crypto.enc.Utf8);
}

//암호화_복호화 불가능함! 동기로 작동
function encryptPassword(data) {
    return Bcrypt.hashSync(data, saltOrRounds);
}

//비밀번호 비교
function comparePassword(beforeEncryptPwd, afterEncryptPwd) {
    return Bcrypt.compareSync(beforeEncryptPwd, afterEncryptPwd);
}

//Session 데이터 가져오기
async function getSessionData(sessionID = "") {
    const result = await inQuirySessionData(sessionID);
    return result;
}

function inQuirySessionData(sessionID = "") {
    let tempData = "출력되면serverFunction에러입니다.";
    const selectUserIdQuery = `
    SELECT data, timestampdiff(hour, from_unixtime(expires),now()) diff
    FROM sessions
    where session_id  = ?
    order by expires ;
    `;

    const deleteSession = `
    delete from sessions where session_id = ? ;
    `;

    const updateLaskWorkTimeQuery = `
    update sys_user_info set lastworktm  = now()
    where userid  = ?`;

    return new Promise((resolve) => {
        getConnection((connection) => {
            exec_sql(connection, selectUserIdQuery, [sessionID])
                .then((data) => {
                    if (data != null && data.length > 0) {
                        tempData = JSON.parse(data[0].data);
                        delete tempData["cookie"];
                        tempData["okyn"] = "Y";
                        let tiemStamp = Math.floor(+new Date() / 1000); // 세컨드 단위로 timeStamp 만들기
                        if (tiemStamp - tempData.timestamp > 3600) {
                            /*활동X 기준 초과, 세션 삭제*/
                            //시간 늘려야할 경우 1시간 == 3600
                            exec_sql(connection, deleteSession, [sessionID]);
                        } else {
                            /*기준 시간 내외 로그인 유지, tiemStamp값 및 lastWorkTime 업데이트*/
                            tempData["timestamp"] = tiemStamp;
                            exec_sql(connection, updateLaskWorkTimeQuery, [tempData.user ? tempData.user : "System"]);
                        }
                    } else {
                        tempData = JSON.parse('{"okyn":"N"}');
                    }
                    resolve(tempData);
                })
                .catch((err) => {
                    tempData = JSON.parse('{"okyn":"N"}');
                    resolve(tempData);
                })
                .finally(() => {
                    connection.release();
                });
        });
    });
}

function deleteSessionTable() {
    schedule.scheduleJob("10 00 00 * * *", function () {
        const selectIdQuery = `
        select userid from sys_user_info where lastworktm <DATE_SUB(now(),INTERVAL 1 HOUR)
        `;
        const deleteSession = `
        delete from sessions
        where session_id in (
                select session_id
                from sessions
                where instr (data,?)
                )
        `;

        getConnection((connection) => {
            (async () => {
                try {
                    //삭제할 ID 조회
                    await exec_sql(connection, selectIdQuery).then((data) => {
                        deleteID = data;
                    });
                    //삭제할 ID가 존재하는 경우 session 테이블에서 삭제
                    if (deleteID) {
                        for (let i = 0; i < deleteID.length; i++) {
                            await exec_sql(connection, deleteSession, [`\"${deleteID[i].userid}\"`]);
                        }
                    }
                } catch (err) {
                    logger.error(err);
                } finally {
                    connection.release();
                }
            })();
        });
    });
}



module.exports = {
    toYYYY_MM_DD,
    toYYYYMMDD,
    toString,
    rand,
    encrypt,
    encryptPassword,
    comparePassword,
    decrypt,
    getSessionData,
    deleteSessionTable,
};
