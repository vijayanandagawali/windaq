import * as Utils from '/js/utils.mjs';
import { getStoredPostLoginRedirect } from '/assets/js/script.js';

$(document).ready(function () {
    // =======================
    // 1. Show login modal
    // =======================
    $(".login_btn").click(function () {
        // clicking the header login explicitly means "normal" login – clear
        // any leaderboard-specific redirect state so we don't later send the
        // user back to a leaderboard they were trying to join earlier.
        localStorage.removeItem("redirectLeaderboardId");
        localStorage.removeItem("redirectParticipate");
        if (localStorage.getItem("redirectAfterLogin") === "/leaderboards") {
          localStorage.removeItem("redirectAfterLogin");
        }

        $(".ck-loginModal").removeClass("d-none");
        $(".loginWnumber").removeClass("d-none");
        $(".ck-loginType").removeClass("d-none");
        $(".ck-requestOtpBtn").removeClass("d-none");
        $(".loginWpassword, .ck-otpVerify, .ck-forgotPassword, .ck-forgotOtpVerify, .ck-changePassword").addClass("d-none");

        // Clear inputs
        $("#login_mobile, #pwd_password, #forgot_mobile, #reset_new_password, #reset_confirm_password").val('');
        $(".otpDigit").val('');
        $(".ck-requestOtpBtn, .ck-pwdLoginBtn, .ck-forgotRequestOtpBtn, .ck-verifyOtpBtn, .ck-forgotVerifyOtpBtn, .ck-resetPasswordBtn").prop("disabled", true);

        // Set OTP tab active
        $(".ck-loginWithOtpBtn").addClass("ck-active");
        $(".ck-loginWithPwdBtn").removeClass("ck-active");

        // Clear OTP error messages
        $("#wrong-otp-error, #wrong-forgot-otp-error").text('');
    });

    // =======================
    // 2. Login Type Switch Tabs
    // =======================
    $(".ck-loginWithPwdBtn").click(function () {
        $(".loginWpassword").removeClass("d-none");
        $(".loginWnumber").removeClass("d-none");
        $(".ck-otpVerify, .ck-forgotPassword, .ck-forgotOtpVerify, .ck-changePassword").addClass("d-none");

        $(this).addClass("ck-active");
        $(".ck-loginWithOtpBtn").removeClass("ck-active");

        $(".ck-requestOtpBtn").addClass("d-none");
        $(".with-otp-login").addClass("d-none");

        $("#pwd_password").val('');
        $(".ck-pwdLoginBtn").prop("disabled", $("#login_mobile").val().length === 10 ? false : true);
        $("#pwd_password").focus();
    });

    $(".ck-loginWithOtpBtn").click(function () {
        $(".loginWnumber").removeClass("d-none");
        $(".with-otp-login").removeClass("d-none");
        $(".loginWpassword").addClass("d-none");
        $(".ck-otpVerify, .ck-forgotPassword, .ck-forgotOtpVerify, .ck-changePassword").addClass("d-none");

        $(this).addClass("ck-active");
        $(".ck-loginWithPwdBtn").removeClass("ck-active");

        $(".ck-requestOtpBtn").removeClass("d-none");

        $("#login_mobile").val('');
        $(".ck-requestOtpBtn").prop("disabled", true);
    });

    /************************************************************
     * 3. STRICT MOBILE NUMBER HANDLING
     ************************************************************/
    $("#login_mobile").on("input", function () {
        let val = $(this).val().replace(/\D/g, "");
        if (val.length > 10) val = val.slice(0, 10);
        $(this).val(val);

        if (val.length === 10) {
            $(".ck-requestOtpBtn").prop("disabled", false);
        } else {
            $(".ck-requestOtpBtn").prop("disabled", true);
        }
    });


    /************************************************************
     * 4. REQUEST OTP BUTTON
     ************************************************************/
    $(".ck-requestOtpBtn").click(async function () {
        let mobile = $("#login_mobile").val();
        if (mobile.length !== 10) return;

        let phoneNumber = "+91" + mobile;

        $("#load_screen").css("display", "flex");
        // only set base redirect if none already stored (leaderboard flow may set it)
        if (!localStorage.getItem("redirectAfterLogin")) {
            localStorage.setItem("redirectAfterLogin", document.referrer);
        }

        let isSasEnable = await getOtpType();

        if (isSasEnable) {
            sendLoginSasOTP(phoneNumber, "send");
        } else {
            let appVerifier = window.recaptchaVerifier;
            sendFirbaseLoginOtp(phoneNumber, appVerifier);
        }
    });


    /************************************************************
     * 5. OTP input behavior
     ************************************************************/
    // $(".otpDigitLogin").on("input", function () {
    //     let $this = $(this);
    //     $this.val($this.val().replace(/\D/g, ""));

    //     if ($this.val().length === 1) {
    //         $this.next(".otpDigitLogin").focus();
    //     }

    //     toggleVerifyOtpButton();
    // });
    $(".otpDigitLogin").on("input", function () {
        let val = $(this).val().replace(/\D/g, "");
        if (val.length > 1) val = val[0];
        $(this).val(val);

        // Move forward
        if (val !== "") {
            $(this).next(".otpDigitLogin").focus();
        }

        toggleVerifyOtpButton();
    });

    // BACKSPACE → Move to previous box
    $(".otpDigitLogin").on("keydown", function (e) {
        if (e.key === "Backspace" && $(this).val() === "") {
            $(this).prev(".otpDigitLogin").focus();
        }

        // Prevent typing more than 1 digit
        if (e.key >= 0 && e.key <= 9 && $(this).val().length === 1) {
            e.preventDefault();
        }
    });


    $(".otpDigitLogin").on("paste", function (e) {
        e.preventDefault();
        let data = (e.originalEvent.clipboardData.getData("text") || "")
            .replace(/\D/g, "")
            .slice(0, 6);

        const $inputs = $(".otpDigitLogin");

        $inputs.each(function (i) {
            $(this).val(data[i] || "");
        });

        // 👇 focus the last filled input AFTER paste finishes
        setTimeout(function () {
            let lastIndex = Math.min(data.length, $inputs.length) - 1;
            if (lastIndex >= 0) {
                $inputs.eq(lastIndex).focus();
            }
        }, 0);

        toggleVerifyOtpButton();
    });


    /************************************************************
     * 6. Verify OTP button
     ************************************************************/
    $(".ck-verifyOtpBtn").click(async function () {
        let otp = "";
        $(".otpDigitLogin").each(function () {
            otp += $(this).val();
        });

        if (otp.length !== 6) return;

        $("#load_screen").css("display", "flex");

        let phoneNumber = "+91" + $("#login_mobile").val();
        let isSasEnable = await getOtpType();

        if (isSasEnable) {
            verifySasOtp(phoneNumber, otp);
        } else {
            verifyFirebaseOTP(otp, phoneNumber);
        }
    });


    /************************************************************
     * 7. Resend OTP
     ************************************************************/
    $(".ck-resendOtpBtn").click(async function () {
        if ($(this).prop("disabled")) return;

        let phoneNumber = "+91" + $("#login_mobile").val();
        $("#load_screen").css("display", "flex");

        $(".otpDigitLogin").val("");

        let isSasEnable = await getOtpType();

        if (isSasEnable) {
            sendLoginSasOTP(phoneNumber, "resend");
        } else {
            let appVerifier = window.recaptchaVerifier;
            sendFirbaseResendLoginOtp(phoneNumber, appVerifier);
        }
    });

    // =======================
    // 8. Back buttons
    // =======================
    $(".ck-backBtn").click(function () {
        let target = $(this).data('back'); // assign data-back="loginWnumber" etc.
        $(".ck-otpVerify, .ck-forgotPassword, .ck-forgotOtpVerify, .ck-changePassword").addClass("d-none");
        $(`.${target}`).removeClass("d-none");

        // Reset OTP error
        $("#wrong-otp-error, #wrong-forgot-otp-error").text('');
    });

    // =======================
    // 9. Close modal
    // =======================
    $(".close-loginRegister-modal, .close-icon").click(function () {
        $(".ck-registerModal").addClass("d-none");
        $(".ck-loginModal").addClass("d-none");
    });

});

/******************************************************************
 * 6. SHOW OTP SCREEN (NEW TEMPLATE)
 ******************************************************************/
function showOTPModel(type) {
    $("#wrong-otp-error").text("");

    // Hide login forms, show OTP
    $(".loginWnumber").addClass("d-none");
    $(".ck-loginType").addClass("d-none");
    $(".ck-otpVerify").removeClass("d-none");

    // Clear digit fields
    $(".otpDigitLogin").val("");
    // ✅ Focus hidden autofill input first
    setTimeout(() => {
        $("#otpAutofill").focus();
    }, 100);

    // ✅ Immediately move focus to first visible OTP box
    setTimeout(() => {
        $(".otpDigitLogin").first().focus();
    }, 150);

    if (type === 1) {
        alertify.notify("OTP has been sent successfully!", "success", 6);
        alertify.set('notifier', 'position', 'top-right');
    } else {
        alertify.notify("OTP resent successfully!", "success", 5);
        alertify.set('notifier', 'position', 'top-right');
    }

    startResendOtpTimer();

    $("#load_screen").hide();
}

/******************************************************************
 * 7. ENABLE VERIFY OTP BTN ONLY WHEN ALL 6 DIGITS FILLED
 ******************************************************************/
function toggleVerifyOtpButton() {
    let filled = true;
    $(".otpDigitLogin").each(function () {
        if ($(this).val().length === 0) filled = false;
    });

    $(".ck-verifyOtpBtn").prop("disabled", !filled);
}

/******************************************************************
 * 8. RESEND OTP TIMER (60 SECONDS)
 ******************************************************************/
function startResendOtpTimer() {
    let btn = $(".ck-resendOtpBtn");
    let counter = 60;

    btn.prop("disabled", true).addClass("disabled");
    btn.text(`Resend OTP in ${counter}s`);

    let timer = setInterval(() => {
        counter--;
        btn.text(`Resend OTP in ${counter}s`);

        if (counter <= 0) {
            clearInterval(timer);
            btn.prop("disabled", false).removeClass("disabled");
            btn.text("Resend OTP");
        }
    }, 1000);
}

/******************************************************************
 * 9. SEND OTP – SAS SERVER
 ******************************************************************/
function sendLoginSasOTP(phoneNumber, type) {

    $.ajax({
        url: "/api/v1/send-otp",
        type: "POST",
        data: {
            phoneNumber: phoneNumber
        },
        success: function (data) {

            if (data.statusCode === 200) {

                $("#otp_mobile_display").text(phoneNumber);
                if (type === "send") showOTPModel(1);
                else showOTPModel(2);
                console.log("registrationAttempted called with phone number:", phoneNumber );
                registrationAttempted(phoneNumber);

            } else {
                $("#load_screen").hide();
                $("#login_error").text(data.response.message);
            }
        },
        error: function (data) {
            $("#load_screen").hide();
            $("#login_error").text("Server error");
        }
    });

}

/******************************************************************
 * 10. SEND OTP – FIREBASE AUTH
 ******************************************************************/
function sendFirbaseLoginOtp(phoneNumber, appVerifier) {
    firebase.auth()
        .signInWithPhoneNumber(phoneNumber, appVerifier)
        .then((confirmationResult) => {
            window.confirmationResult = confirmationResult;
            showOTPModel(1);
            registrationAttempted(phoneNumber);
        })
        .catch((error) => {
            $("#load_screen").hide();
            $("#login_error").text(error.message || "OTP send failed");
        });
}

/******************************************************************
 * 11. RESEND OTP – FIREBASE
 ******************************************************************/
function sendFirbaseResendLoginOtp(phoneNumber, appVerifier) {

    firebase.auth()
        .signInWithPhoneNumber(phoneNumber, appVerifier)
        .then((confirmationResult) => {
            window.confirmationResult = confirmationResult;
            showOTPModel(2);
        })
        .catch((error) => {
            $("#load_screen").hide();
            $("#wrong-otp-error").text(error.message);
        });
}

/******************************************************************
 * 12. VERIFY OTP – FIREBASE
 ******************************************************************/
function verifyFirebaseOTP(code, phoneNumber) {
    confirmationResult
        .confirm(code)
        .then(function (authResult) {

            authResult.user.getIdToken().then(function (idToken) {

                let username = generateUniqueUsername(6);
                let promocode = $("#promocode").val();
                let stag = getCookie("stag") || "";

                let url = "/api/v1/signup";
                if (stag !== "") url += "?stag=" + stag;

                $.ajax({
                    type: "POST",
                    url: url,
                    data: {
                        accessToken: idToken,
                        username: username,
                        promo_code: promocode,
                        stag: stag
                    },
                    success: function (data) {

                        $("#load_screen").hide();

                        if (!data.success) {
                            $("#wrong-otp-error").text(data.error);
                            return;
                        }

                        // Save user
                        localStorage.setItem("user-details", JSON.stringify(data));
                        localStorage.setItem("user-id", data.userid);

                        handleMoengageLogin(data, phoneNumber);

                    }
                });

            });

        })
        .catch(function () {
            $("#load_screen").hide();
            $("#wrong-otp-error").text("Invalid OTP");
        });
}

/******************************************************************
 * 13. VERIFY OTP – SAS
 ******************************************************************/
function verifySasOtp(phoneNumber, otp) {
    var stag = getCookie('stag') == null ? '' : getCookie('stag');
    var utm_source = getCookie('utm_source') == null ? '' : getCookie('utm_source');
    const generatedUsername = generateUniqueUsername(6);
    $.ajax({
        url: "/api/v1/verify-otp",
        type: "POST",
        data: {
            phoneNumber: phoneNumber,
            username: generatedUsername,
            code: parseInt(otp, 10),
            stag: stag,
            url: window.location.href,
        },
        success: function (data) {

            if (data.success) {

                if (data.isPasswordResetRequired) {
                    window.loginPwdIdToken = data.pwdSasToken;
                    window.loginSessionVal = data.usersession;
                    window.loginUname = data.uname;
                    window.loginResnewSignup = data.newSignup;
                    window.loginResponseData = data;
                    window.loginResmobile = phoneNumber;
                    // window.loginIsUsernameUpdated = data.isUsernameUpdated;

                    

                    $(".ck-otpVerify").addClass("d-none");
                    $(".ck-changePassword").removeClass("d-none");
                    $(".close-loginRegister-modal, .close-icon").addClass("d-none");
                    return;
                } else {
                    localStorage.setItem("user-details", JSON.stringify(data));
                    localStorage.setItem("user-id", data.userid);

                    handleMoengageLogin(data, phoneNumber);
                    eraseCookie('stag')
                    eraseCookie('utm_source')
                }
            } else {
                $("#wrong-otp-error").text(data.error || "Invalid OTP");
            }

            $("#load_screen").hide();
        },
        error: function () {
            $("#load_screen").hide();
            $("#wrong-otp-error").text("Invalid OTP");
        }
    });

}

/******************************************************************
 * 14. AFTER SUCCESSFUL OTP LOGIN
 ******************************************************************/
function handleMoengageLogin(data, phoneNumber) {

    let utm_source = getCookie("utm_source") || "{}";

    const user = {
        id: data.userid,
        name: data.uname,
        mobile: phoneNumber
    };
    if(!data.newSignup){
        Moengage.add_unique_user_id(user.id).then(function () {
        Moengage.add_user_attribute("name", user.name);
        Moengage.add_mobile(user.mobile);

        Moengage.track_event("Login", {
            MobileNumber: phoneNumber,
            userName: data.uname,
            userID: data.userid,
            SourceName: utm_source
        }).then(() => {


      // 🔥 STEP 1: Check pending game
      let pendingGame = JSON.parse(localStorage.getItem("pending_game_launch"));
      console.log("Pending game launch data:", pendingGame);

      if (pendingGame && pendingGame.game) {
        let payload = JSON.parse(localStorage.getItem("pending_game_launch"));

        if (String(payload.game || "").toLowerCase() === "lucky swipe") {
          localStorage.removeItem("pending_game_launch");
          window.location.href = "/lucky-swipe";
          return;
        }

        // 🧹 Prevent duplicate
        localStorage.removeItem("pending_game_launch");

        // 🔥 STEP 2: Call API again
        $.ajax({
          url: "/api/v1/game-launch-url",
          type: "POST",
          dataType: "json",
          data: payload,
          success: function (res) {
            if (res.statusCode == 200) {
              let game = String(payload.game || "").toLowerCase();
              let category = String(payload.game_play_category || "").toLowerCase();

              window.location.href =
                "/game-play?game=" +
                encodeURIComponent(game) +
                "&category=" +
                encodeURIComponent(category);
            } else {
              window.location.href = "/";
            }
          },
          error: function () {
            window.location.href = "/";
          }
        });

      } else {
        window.location.href = getStoredPostLoginRedirect(data);
      }

        });
    });

    }else{
    Moengage.add_unique_user_id(data.userid).then(function () {
        Moengage.add_mobile(phoneNumber);

        window.location.href = "/user/registration-status";
    });
    //     Moengage.add_unique_user_id(phoneNumber).then(function () {
    //     Moengage.add_mobile(phoneNumber);
    //     Moengage.track_event("Registration", {
    //         MobileNumber: phoneNumber,
    //         SourceName: utm_source,
    //         Platform: "Web",
    //     }).then(() => {

    //         window.location.href = "/user/registration-status";

    //     });

    // });
        
    }
    
}

/******************************************************************
 * 15. REGISTRATION / LOGIN ATTEMPT (MoEngage)
 ******************************************************************/
function registrationAttempted(phoneNumber) {
    let utm = getCookie("utm_source") || "{}";
    console.log("registrationAttempted inside function:", phoneNumber);
    checkUserExists(phoneNumber, function (exists) {
        console.log("User exists:", exists);
        if (exists) {
            console.log("Tracking Login Attempted for checkuserexists:", phoneNumber);
            Moengage.track_event("Login Attempted", {
                MobileNumber: phoneNumber,
                SourceName: utm,
                Platform: "Web"
            });
        } else {
            console.log("Tracking Registration Attempted for checkuserexists:", phoneNumber);
            Moengage.track_event("Registration Attempted", {
                MobileNumber: phoneNumber,
                SourceName: utm,
                Platform: "Web"
            });
        }
    });
}

/******************************************************************
 * 16. CHECK USER EXISTS
 ******************************************************************/
function checkUserExists(phoneNumber, callback) {
    $.ajax({
        url: "/api/v1/isPlayerExists",
        type: "GET",
        data: { phoneNumber },
        success: function (data) {
            callback(data.response.phone_number_exists);
        },
        error: function () {
            callback(false);
        }
    });
}

const otpInputs = document.querySelectorAll('.otpDigitLogin');
const otpAuto = document.getElementById('otpAutofill');

otpAuto.addEventListener('input', () => {
    const otp = otpAuto.value.replace(/\D/g, '');

    otp.split('').forEach((digit, i) => {
        if (otpInputs[i]) {
            otpInputs[i].value = digit;
        }
    });

    if (otp.length >= otpInputs.length) {
        otpInputs[otpInputs.length - 1].focus();
    }
});