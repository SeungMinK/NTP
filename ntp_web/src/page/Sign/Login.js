import "../../css/Login.css";

function Login() {
  return (
    <>
      <div className="sign-body" style={{ backgroundImage: `url(${process.env.PUBLIC_URL + "/logo/bg.jpg"})` }}>
        <div className="sign-wrap">
          <div className="login">
            <div className="titlebox">
              <img src="../logo/logo_c.png" className="sign-logo" />
              <span className="GeoAI-Platform"> GeoAI Platform </span>
            </div>
            <div>
              <br />
            </div>
            <div>
              <span className="Please-log-in-or-sign-up-for-an-account">Please login or sign up for an account</span>
            </div>
            <div className="login-id">
              <h4 className="login-idpw-title">User ID</h4>
              <input type="email" name="" id="" placeholder=" name@domain.com " style={{ fontSize: "15px" }} />
            </div>
            <div className="login-pw">
              <h4 className="login-idpw-title">Password</h4>
              <input type="password" name="" id="" placeholder=" " />
            </div>
            <div className="login-etc">
              <div className="checkbox" style={{ color: "rgba(0, 0, 0, 0.65)", fontSize: "15px" }}>
                <input type="checkbox" name="" id="" /> Save ID
              </div>
              <div className="sign-forgot-pw">
                <span className="sign-ForgotPwTxt">Forgot Password</span>
                <span className="sign-upTXT">Sign up</span>
              </div>
            </div>
            <div className="sign-submit">
              <input
                type="button"
                value="LOGIN"
                onClick={() => {
                  console.log("눌림");
                  window.location.replace("/Home");
                }}
              />
            </div>
          </div>
        </div>
        <div className="sign-box">
          <div className="sign-box1">
            <img src="../logo/logo_w.png" />
          </div>
          <div className="sign-box2"></div>
        </div>
      </div>
    </>
  );
}

export default Login;
