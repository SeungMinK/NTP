/*API 기능 담당 WAS*/
const express = require("express");
const cors = require("cors");
const session = require("express-session");
const MySQLStore = require("express-mysql-session")(session);
const sf = require("../lib/serverFunction");

const app = express();
require("dotenv").config();

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: false }));

/*모듈 사용 선언*/

const logger = require("../public/js/logger");

// Log 관련
const morgan = require("morgan"); // 요청과 응답 에 대한 정보를 콘솔에 출력
app.use(morgan("dev")); // (dev, combined ... )

const config = {
    host: process.env.HOST,
    port: process.env.PORT,
    user: process.env.USER,
    password: process.env.PASSWORD,
    database: process.env.DATABASE,
    connectionLimit: process.env.CONNETCIONLIMIT,
};

/*session 설정 부분*/
app.use(
    session({
        secret: process.env.SESSION_KEY, // 세션을 발급할 때 사용되는 키입니다.
        resave: false,
        saveUninitialized: false,
        store: new MySQLStore(config),
    })
);

// 보안 처리
const helmet = require("helmet"); // Http 헤더 설정을 자동으로 바꾸어주어 잘 알려진 몇가지 앱의 취약성으로 부터 앱을 보호
app.disable("x-powered-by"); // Express가 사용되었다는 것을 숨기는 방법
app.use(helmet.dnsPrefetchControl());
app.use(helmet.expectCt());
app.use(helmet.frameguard());
app.use(helmet.hidePoweredBy());
app.use(helmet.hsts());
app.use(helmet.ieNoOpen());
app.use(helmet.permittedCrossDomainPolicies());
app.use(helmet.referrerPolicy());
app.use(helmet.xssFilter()); // XSS(교차 사이트 스크립팅) 방어
app.use(helmet.frameguard("deny")); // 클릭재킹으로 부터 보호(deny:프레임 내에 우리 사이트를 넣지 못하게 함)
app.use(cors()); //cors 에러 해결


/*WAS 서버 오픈 port*/
const port = 8081;
if (process.env.MODE === "RELEASE") {
    /*======================== RELEASE MODE===================================================================================*/
    app.listen(port, () => {
        
        logger.info(`[HTTP] WAS START PORT :  ${port}`);
        /*======================================================================================================================*/
    });
} else {
    /*======================== DEV MODE===================================================================================*/
    app.listen(port, () => {
        logger.info(`[HTTP] WAS START PORT :  ${port}`);
        /*======================================================================================================================*/
    });
}
