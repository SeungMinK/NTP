let express = require("express");
let router = express.Router();

const sf = require("../../lib/serverFunction");
const getConnection = require("../../lib/db");
const logger = require("../../public/js/logger");
const exec_sql = require("../../public/js/exec_sql");
const multer = require("multer");
const fs = require("fs");

const filePathPython = process.env.DATA_PATH + "/python/";
const filePathModel = process.env.DATA_PATH + "/model/";
const moment = require("moment");

/* Mode
'P' = Python
'M' = Model
*/

/*파일 업로드를 위한 Multer 사용 선언*/
function fileUpload(req, res, mode, userid) {
    const filePath = mode === "P" ? filePathPython : filePathModel;
    const storage = multer.diskStorage({
        destination: function (req, file, cb) {
            cb(null, `${filePath}`); // 파일이 저장되는 경로입니다.
        },
        filename: function (req, file, cb) {
            cb(null, userid + "_" + moment().format("YYYYMMDDHHmmss") + "_" + file.originalname); // 저장되는 파일명
        },
    });

    const upload = multer({ storage: storage }).single("file"); // single : 하나의 파일업로드 할때
    upload(req, res, function (err) {
        if (err instanceof multer.MulterError) {
        } else if (err) {
        }
        getConnection((connection) => {
            console.log("요청옴#2");
            if (req.file) {
                try {
                    const insertSQL = `
                    insert into ln_file_info (filetype,fileurl,filename,createid,createtm) values(?,?,?,?,now())
                    `;
                    const body = [mode, req.file.path, req.file.filename, userid];
                    exec_sql(connection, insertSQL, body);
                    res.send(true);
                } catch (err) {
                    //DB에 insert 실패, 파일이 있을 경우 파일 삭제
                    if (fs.existsSync(req.file.path)) {
                        fs.unlinkSync(req.file.path);
                    }
                    logger.error(err);
                    res.send(false);
                } finally {
                    connection.release();
                }
            } else {
                res.send("Empty Files");
            }
        });
    });
}

/*파이썬코드 업로드*/
router.post("/uploadPython", function (req, res) {
    const sessionid = req.headers.authorization;
    if (sessionid) {
        sf.getSessionData(sessionid).then((rv) => {
            if (rv.okyn === "Y") {
                /*========BIZ LOGIC BEGIN========*/
                console.log("요청옴#1");
                fileUpload(req, res, "P", rv.user ? rv.user : "System Init");
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

/*모델 업로드*/
router.post("/uploadModel", function (req, res) {
    const sessionid = req.headers.authorization;
    if (sessionid) {
        sf.getSessionData(sessionid).then((rv) => {
            if (rv.okyn === "Y") {
                /*========BIZ LOGIC BEGIN========*/
                fileUpload(req, res, "M", rv.user ? rv.user : "System Init");
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

/*파일 다운로드*/
router.post("/download", function (req, res) {
    const sessionid = req.headers.authorization;
    if (sessionid) {
        sf.getSessionData(sessionid).then((rv) => {
            if (rv.okyn === "Y") {
                /*========BIZ LOGIC BEGIN========*/
                const selectFilePath = `
                select filename from ln_file_info where fileid = ? and createid = ?
                `;
                getConnection((connection) => {
                    exec_sql(connection, selectFilePath, [req.body.fileid, rv.user]).then((data) => {
                        res.send(`${data[0].filename}`);
                    });
                });

                /*======BIZ LOGIC END======*/
            } else {
                //okyn ==="N"
                console.log(rv.okyn);
                res.status(403).send(false); //이벤트 처리 안되게
            }
        });
    } else {
        //sessionID가 전달되지않았음
        res.status(401).send(false); //이벤트 처리 안되게
    }
});

/*조회*/
router.post("/inquiry", function (req, res) {
    if (req.body.sessionid) {
        sf.getSessionData(req.body.sessionid).then((rv) => {
            if (rv.okyn === "Y") {
                /*========BIZ LOGIC BEGIN========*/

                const selectQuery = `
                select * from ln_file_info
                where filetype = ? and createid = ?
                `;
                const body = [req.body.filetype, rv.userid];

                getConnection((connection) => {
                    try {
                        exec_sql(connection, selectQuery, body).then((data) => {
                            res.status(200).send(data);
                        });
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
