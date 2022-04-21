// 공통
let express = require("express");
let router = express.Router();
const key = process.env.ENCRYPT_KEY;
const sf = require("../../lib/serverFunction");
const getConnection = require("../../lib/db");
const logger = require("../../public/js/logger");
const exec_sql = require("../../public/js/exec_sql");
const maxLoginFailCnt = process.env.MAX_LOGIN_FAIL_CNT;
var Storage = require("node-storage");
var store = new Storage("store/token/file");

//로그인
router.post("/in", function (req, res) {
    //접속 시도한 IP 분리
    const userIP = req.ip.split(":")[3];

    const selectPwdQuery = `
    select statuscd, pwd, loginfailcnt,usergrpcd
    from sys_user_info
    where userid = ?
    `;

    //암호 일치시 로그인 실패 횟수 0으로 초기화 쿼리
    const updateZeroCnt = `update sys_user_info set loginfailcnt=0,lastworktm =now() where userid =?`;
    //암호 불일치시 로그인 실패 횟수 증가 쿼리
    const updateFailCntPlus = `
      update sys_user_info set loginfailcnt=ifnull(loginfailcnt,0)+1,
      statuscd = case when ifnull(loginfailcnt,0)+1 > ? then 'E1'
      else statuscd end where userid =?
       `;
    //마지막 활동시간 업데이트
    const updateLaskWorkTimeQuery = `
       update sys_user_info set lastworktm  = now()
       where userid  = ?`;

    //관리자 IP 조회
    const selectAdminIPQuery = `select itemnm from sys_cd_item where grpcd = 'AD100' and  itemcd = 'IP'`;

    let beforeEncryptPwd = req.body.pwd; //암호화전 사용자 입력값 password
    let afterEncryptPwd = ""; //암호화된값 저장용
    let statuscd = "P";
    const ID = req.body.userid ? req.body.userid : "null";
    let pwd = "";

    let usergrpcd = "";

    getConnection((connection) => {
        (async () => {
            try {
                /*회원가입된 계정인지 조회*/
                let data = await exec_sql(connection, selectPwdQuery, [req.body.userid]);
                /*회원가입된 계정이 아닐 경우 FALSE*/
                if (data != undefined && data != null && data.length > 0) {
                    statuscd = data[0].statuscd ? data[0].statuscd : "N";
                    pwd = data[0].pwd ? data[0].pwd : null;
                    usergrpcd = data[0].usergrpcd;
                } else {
                    /*아이디가 존재하지않음 */
                    res.status(200).send({
                        statusCode: "E001",
                        okYN: "N",
                        data: {
                            statuscd: statuscd,
                        },
                        //msg: "회원가입되지 않은 아이디입니다. 아이디를 다시 확인해주세요",
                    });
                    return false;
                }

                //계정상태가 정상 계정인 경우에만
                if (statuscd === "Y") {
                    afterEncryptPwd = pwd ? pwd : "";
                    afterEncryptPwd = pwd ? pwd : "";
                    //조회결과 상태가 Y인 경우에만 비밀번호 비교 실시
                    if (sf.comparePassword(beforeEncryptPwd, afterEncryptPwd)) {
                        //[암호 비교 성공]_이벤트 처리 : 로그인 횟수 초기화
                        //활동시간 업데이트
                        await exec_sql(connection, updateLaskWorkTimeQuery, [ID]);
                        //비밀번호 오류  횟수 초기화
                        await exec_sql(connection, updateZeroCnt, [ID]);

                        let IP_DATA = await exec_sql(connection, selectAdminIPQuery);
                        req.session.user = ID;
                        req.session.timestamp = Math.floor(+new Date() / 1000); // +new Date() 이렇게만 쓰면 밀리세컨드 단위
                        req.session.save(function () {});

                        if (usergrpcd == "SU") {
                            for (var i = 0; i < IP_DATA.length; i++) {
                                if (userIP == IP_DATA[i].itemnm) {
                                    res.status(200).send({
                                        statusCode: "S002",
                                        okYN: "A",
                                        sessionID: req.sessionID,
                                        statuscd: statuscd,
                                        // msgid: "로그인에 성공하였습니다.", //sessionID 반환
                                    });
                                    return 0;
                                }
                            }
                        }

                        //요청 성공
                        res.status(200).send({
                            statusCode: "S001",
                            okYN: "Y",
                            sessionID: req.sessionID,
                            statuscd: statuscd,

                            // msgid: "로그인에 성공하였습니다.", //sessionID 반환
                        });

                        //토큰 발급
                        logger.info("접속한 사용자 :  [ " + ID + " ]");
                    } else {
                        //[암호 비교 실패]_ 이벤트 처리 : 로그인 횟수 ++
                        await exec_sql(connection, updateFailCntPlus, [maxLoginFailCnt, ID])
                            .then(() => {})
                            .catch(() => {})
                            .finally(() => {
                                //암호 불일치
                                res.status(200).send({
                                    statusCode: "E002",
                                    okYN: "N",
                                    data: {
                                        statuscd: statuscd,
                                    },
                                    //msg: "잘못된 패스워드입니다. 비밀번호를 다시 확인해주세요",
                                });
                            });
                    }
                } else {
                    /*아이디는 존재하는데 비 정상 계정[비밀번호 5회 오류, 휴면계정, 사용 중단 계정 등] _ 관리자에게 문의 필요 */
                    res.status(200).send({
                        statusCode: "E003",
                        okYN: "N",
                        data: {
                            statuscd: statuscd,
                        },
                        //msg: "사용할 수 없는 계정입니다. 관리자에게 문의해주세요",
                    });
                }
            } catch (err) {
                res.status(200).send({
                    statusCode: "E000",
                    okYN: "N",
                    data: {
                        statuscd: statuscd,
                    },
                });
                logger.error(err);
            } finally {
                connection.release();
            }
        })();
    });
});

////아이디 중복 체크
router.post("/checkId", function (req, res) {
    const inquiryIdQuery = `
    select * from 
    (
    select  userid from sys_user_apply where statuscd = 'A'
    UNION 
    select    userid from sys_user_info_v  
    ) as usertable
    where userid = ?
  `;

    getConnection((connection) => {
        exec_sql(connection, inquiryIdQuery, [req.body.userid])
            .then((data) => {
                if (data.length === 0) res.status(200).send(true);
                else res.status(400).send(false);
            })

            .catch((err) => {
                logger.error(err);
                res.status(400).send(false);
            })
            .finally(() => {
                connection.release();
            });
    });
});

////로그아웃_Web;
router.post("/logout", function (req, res) {
    const deleteQuery = `
    DELETE from sessions where session_id = ?    
    `;

    getConnection((connection) => {
        exec_sql(connection, deleteQuery, [req.body.sessionid])
            .then((data) => {
                if (data) {
                    res.status(200).send(true);
                } else res.status(400).send(false);
            })

            .catch((err) => {
                logger.error(err);
                res.status(400).send(false);
            })
            .finally(() => {
                connection.release();
            });
    });
});

module.exports = router;
