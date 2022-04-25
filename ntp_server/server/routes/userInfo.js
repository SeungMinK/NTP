let express = require("express");
let router = express.Router();

// 공통
const sf = require("../../lib/serverFunction");
const getConnection = require("../../lib/db");
const logger = require("../../public/js/logger");
const exec_sql = require("../../public/js/exec_sql");
const key = process.env.ENCRYPT_KEY;

//회원가입 쿼리
router.post("/addUser", function (req, res) {
    if (req.body.sessionid) {
        sf.getSessionData(req.body.sessionid).then((rv) => {
            if (rv.okyn === "Y") {
                /*========BIZ LOGIC BEGIN========*/
                const checkIdQuery = `
                select userid from sys_user_info where userid=?
                union 
                select userid from sys_user_apply
                where  statuscd!='N' and userid =?
                `;
                const addUserQuery = `
                insert into sys_user_info (userid, pwd, usernm, email, createid,createtm,loginfailcnt,statuscd,usergrpcd,cellphone)
                values (
                    ?, ?, 
                HEX(AES_ENCRYPT(?, SHA2(?, 256))),HEX(AES_ENCRYPT(?, SHA2(?, 256))), 
                ?, now(),?,?,?,
                HEX(AES_ENCRYPT(?, SHA2(?, 256))))
               `;
                const addUserBody = [
                    req.body.userid,
                    sf.encryptPassword(req.body.pwd),
                    req.body.usernm,
                    key,
                    req.body.email,
                    key,
                    rv.user,
                    0,
                    "Y",
                    req.body.usergrpcd,
                    req.body.cellphone,
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
                            await exec_sql(connection, addUserQuery, addUserBody);
                            res.status(200).send(true);
                        } catch (err) {
                            logger.error(err);
                            res.status(400).send(false);
                        } finally {
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

//회원 조회 요청
router.post("/inquiry", function (req, res) {
    if (req.body.sessionid) {
        sf.getSessionData(req.body.sessionid).then((rv) => {
            if (rv.okyn === "Y") {
                /*========BIZ LOGIC BEGIN========*/

                let inquiryUserQuery = `
                select userid,
                CONVERT(AES_DECRYPT(UNHEX(usernm), SHA2(?,256)) USING UTF8) as usernm,
                CONVERT(AES_DECRYPT(UNHEX(email), SHA2(?,256)) USING UTF8) as email,
                CONVERT(AES_DECRYPT(UNHEX(cellphone), SHA2(?,256)) USING UTF8) as cellphone,
                statuscd,usergrpcd,date_format(lastworktm,'%Y-%m-%d %H:%i')lastworktm
                from sys_user_info
                WHERE userid like concat('%',?,'%')
                and CONVERT(AES_DECRYPT(UNHEX(usernm), SHA2(?,256)) USING UTF8) like concat('%',?, '%') 
                and CONVERT(AES_DECRYPT(UNHEX(email), SHA2(?,256)) USING UTF8) like concat('%',?, '%') 
                and CONVERT(AES_DECRYPT(UNHEX(cellphone), SHA2(?,256)) USING UTF8)  like concat('%',?, '%') 
                `;

                getConnection((connection) => {
                    exec_sql(connection, inquiryUserQuery, [
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
                    ])
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

//사용자 정보 업데이트 요청 처리
router.post("/updateUser", function (req, res) {
    if (req.body.sessionid) {
        sf.getSessionData(req.body.sessionid).then((rv) => {
            if (rv.okyn === "Y") {
                /*========BIZ LOGIC BEGIN========*/

                const updateUserQuery = `
                update sys_user_info 
                set usernm = HEX(AES_ENCRYPT(?, SHA2(?, 256))), 
                email = HEX(AES_ENCRYPT(?, SHA2(?, 256))), 
                cellphone = HEX(AES_ENCRYPT(?, SHA2(?, 256))), 
                usergrpcd = ?,  updateid = ?, updatetm = now() where userid = ?
              `;
                const body = [
                    req.body.usernm,
                    key,
                    req.body.email,
                    key,
                    req.body.cellphone,
                    key,
                    req.body.usergrpcd,
                    rv.user,
                    req.body.userid,
                ];

                //트랜젝션 처리
                getConnection((connection) => {
                    try {
                        //Transaction Begin
                        exec_sql(connection, updateUserQuery, body);
                        res.status(200).send(true);
                    } catch (err) {
                        logger.error(err);
                        res.status(400).send(false);
                    } finally {
                        connection.release();
                    }
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

//계정 상태 변경
router.post("/updateStatuscd", function (req, res) {
    if (req.body.sessionid) {
        sf.getSessionData(req.body.sessionid).then((rv) => {
            if (rv.okyn === "Y") {
                /*========BIZ LOGIC BEGIN========*/

                const updateQuery = `
                update sys_user_info set 
                statuscd = ?, updateid = ?, updatetm = now() where userid = ?
                `;

                const body = [req.body.statuscd, rv.user, req.body.userid];
                getConnection((connection) => {
                    try {
                        exec_sql(connection, updateQuery, body);
                        res.status(200).send(true);
                    } catch (err) {
                        logger.error(err);
                        res.status(400).send(false);
                    } finally {
                        connection.release();
                    }
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

router.post("/delete", function (req, res) {
    if (req.body.sessionid) {
        sf.getSessionData(req.body.sessionid).then((rv) => {
            if (rv.okyn === "Y") {
                /*========BIZ LOGIC BEGIN========*/

                const deleteQuery = `
                DELETE FROM kigam.sys_user_info
                WHERE userid=?;
                `;

                const body = [req.body.userid];
                getConnection((connection) => {
                    try {
                        exec_sql(connection, deleteQuery, body);
                        res.status(200).send(true);
                    } catch (err) {
                        logger.error(err);
                        res.status(400).send(false);
                    } finally {
                        connection.release();
                    }
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
