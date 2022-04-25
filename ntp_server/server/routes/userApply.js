let express = require("express");
let router = express.Router();
const key = process.env.ENCRYPT_KEY;
// 공통
const sf = require("../../lib/serverFunction");
const getConnection = require("../../lib/db");
const logger = require("../../public/js/logger");
const exec_sql = require("../../public/js/exec_sql");
const BRIGHTICS_SERVER = process.env.BRIGHTICS_SERVER_HOST;

//회원가입(신청)_sessionID가 없는게 정상
router.post("/apply", function (req, res) {
    const checkIdQuery = `
    select userid from sys_user_info where userid=?
    union 
    select userid from sys_user_apply
    where  statuscd!='N' and userid =?
    `;

    const addUserQuery = `  
        insert into sys_user_apply (applyid,userid, pwd,usernm,email,statuscd,applytm)
        select ifnull(max(applyid),0)+1,?,?,
        HEX(AES_ENCRYPT(?, SHA2(?, 256))),HEX(AES_ENCRYPT(?, SHA2(?, 256))),'A',now()
        from sys_user_apply
    `;
    const body = [
        req.body.userid,
        sf.encryptPassword(req.body.pwd), //비대칭키 암호화
        req.body.usernm,
        key, //대칭키 암호화
        req.body.email,
        key,
    ];

    getConnection((connection) => {
        (async () => {
            try {
                let checkid = await exec_sql(connection, checkIdQuery, [req.body.userid, req.body.userid]);
                if (checkid.length) {
                    //중복체크 결과 값이 있으면 회원가입 신청X
                    res.status(200).send({ error: "이미 신청 된 아이디입니다." });
                    return false;
                }
                await exec_sql(connection, addUserQuery, body);
                res.status(200).send(true);
            } catch (err) {
                logger.error(err);
            } finally {
                connection.release();
            }
        })();
    });
});

//회원 조회 요청
router.post("/inquiry", function (req, res) {
    if (req.body.sessionid) {
        sf.getSessionData(req.body.sessionid).then((rv) => {
            if (rv.okyn === "Y") {
                /*========BIZ LOGIC BEGIN========*/

                let inquiryUserQuery = `
                    select a.applyid, a.userid, a.handlerid, a.revokemsg, a.statuscd,
                    date_format(a.applytm,'%Y-%m-%d %H:%i') applytm,
                    date_format(a.handletm,'%Y-%m-%d %H:%i') handletm,
                    CONVERT(AES_DECRYPT(UNHEX(a.usernm), SHA2(?,256)) USING UTF8) as usernm,
                    CONVERT(AES_DECRYPT(UNHEX(a.email), SHA2(?,256)) USING UTF8) as email,
                    CONVERT(AES_DECRYPT(UNHEX(a.cellphone), SHA2(?,256)) USING UTF8) as cellphone
                    from sys_user_apply a
                    
                    WHERE userid like concat('%',?,'%')
                    and CONVERT(AES_DECRYPT(UNHEX(usernm), SHA2(?,256)) USING UTF8) like concat('%',?, '%') 
                    and CONVERT(AES_DECRYPT(UNHEX(email), SHA2(?,256)) USING UTF8) like concat('%',?, '%') 
                    and CONVERT(AES_DECRYPT(UNHEX(cellphone), SHA2(?,256)) USING UTF8)  like concat('%',?, '%')
                    and statuscd = ?
            `;

                let body = [
                    key,
                    key,
                    key,
                    req.body.userid,
                    key,
                    req.body.usernm,
                    key,
                    req.body.email,
                    key,
                    req.body.cellphone,
                    req.body.statuscd,
                ];

                getConnection((connection) => {
                    exec_sql(connection, inquiryUserQuery, body)
                        .then((data) => {
                            res.status(200).send(data);
                        })
                        .catch((err) => {
                            logger.error(err);
                            res.status(400).send(false);
                        })
                        .finally(() => {
                            connection.release();
                        });
                });

                /*======BIZ LOGIC END======*/
            } else {
                //okyn ==="N"
                res.status(403).send(false); //이벤트 처리 안되게
            }
        });
    } else {
        //sessionID가 전달되지않았음
        res.status(401).send(false); //이벤트 처리 안되게
    }
});

//승인
router.post("/approve", function (req, res) {
    if (req.body.sessionid) {
        sf.getSessionData(req.body.sessionid).then((rv) => {
            if (rv.okyn === "Y") {
                /*========BIZ LOGIC BEGIN========*/

                const checkIdQuery = `
                select userid from sys_user_info where userid=?
                `;
                const insertUserQuery = `  
                insert into sys_user_info
                (userid, pwd, usernm , email, usergrpcd,statuscd, loginfailcnt, lastworktm, createid, updateid, createtm, updatetm)
                select userid, pwd, usernm, email,?,'Y', 0, now(), ?, ?, now(), now()
                from sys_user_apply 
                where userid = ? and statuscd != 'N'
                 `;

                const updateStatusQuery = `  
                update sys_user_apply set statuscd='Y', handlerid = ?, 
                handletm = now() 
                where userid = ?`;
                const body1 = [req.body.usergrpcd, rv.user, rv.user, req.body.userid];
                const body2 = [rv.user, req.body.userid];

                getConnection((connection) => {
                    (async () => {
                        try {
                            connection.beginTransaction();
                            let checkid = await exec_sql(connection, checkIdQuery, [req.body.userid, req.body.userid]);
                            if (checkid.length) {
                                //중복체크 결과 값이 있으면 회원가입 신청X
                                res.status(200).send({ error: "계정이 이미 존재합니다." });
                                return false;
                            }
                            await exec_sql(connection, insertUserQuery, body1);
                            await exec_sql(connection, updateStatusQuery, body2);

                            res.status(200).send(true);
                            connection.commit();
                        } catch (err) {
                            logger.error(err);
                            res.status(200).send({ error: "계정 신청 승인 실패" });
                            connection.rollback();
                        } finally {
                            /* BRIGHTICS에 계정 신청 들어가야함*/
                            connection.release();
                        }
                    })();
                });

                /*======BIZ LOGIC END======*/
            } else {
                //okyn ==="N"
                res.status(403).send(false); //이벤트 처리 안되게
            }
        });
    } else {
        //sessionID가 전달되지않았음
        res.status(401).send(false); //이벤트 처리 안되게
    }
});

//반려메시지 생성 및 반려처리
router.post("/revoke", function (req, res) {
    if (req.body.sessionid) {
        sf.getSessionData(req.body.sessionid).then((rv) => {
            if (rv.okyn === "Y") {
                /*========BIZ LOGIC BEGIN========*/

                const updateRevokeQuery = `  
                update sys_user_apply set statuscd='N', 
                revokemsg=?, handlerid = ?, handletm = now() where userid = ?
                `;
                const body1 = [req.body.revokemsg, rv.user, req.body.userid];

                getConnection((connection) => {
                    exec_sql(connection, updateRevokeQuery, body1)
                        .then((data) => {
                            res.status(200).send(true);
                        })
                        .catch((err) => {
                            logger.error(err);
                            res.status(400).send(false);
                        })
                        .finally(() => {
                            connection.release;
                        });
                });

                /*======BIZ LOGIC END======*/
            } else {
                //okyn ==="N"
                res.status(403).send(false); //이벤트 처리 안되게
            }
        });
    } else {
        //sessionID가 전달되지않았음
        res.status(401).send(false); //이벤트 처리 안되게
    }
});

module.exports = router;
