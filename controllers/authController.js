import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import { Access_token, Refresh_token } from "../configs/jwt-token.js";

import {
  AvatarImages,
  getBodyData,
  SendErrorResponce,
} from "../configs/utils.js";

import { validateEmail, validRegister } from "../middlewares/validate.js";

import Users from "../models/userSchema.js";

async function register(req, res) {
  try {
    const { username, email, profession, password } = await getBodyData(req);

    const validateInputs = validRegister(username, email, password, profession);

    if (validateInputs.length > 0) {
      return SendErrorResponce(res, validateInputs);
    }

    const user = await Users.findOne({ email });

    if (user) {
      return SendErrorResponce(res, "Email already exists.");
    }

    const hashPassword = await bcrypt.hash(password, 12);

    const newUserData = {
      username,
      email,
      profession,
      password: hashPassword,
      avatar: AvatarImages[Math.round(Math.random() * 7)],
    };

    const newUser = await new Users(newUserData);

    await newUser.save();

    res.writeHead(201, { "Content-type": "application/json" });
    res.end(JSON.stringify({ msg: "Account created successfully!" }));
  } catch (err) {
    return SendErrorResponce(res, err.message);
  }
}
async function login(req, res) {
  try {
    const { email, password } = await getBodyData(req);
    if (!email || !password) {
      return SendErrorResponce(res, "Please fill all fields");
    }
    if (!validateEmail(email)) {
      return SendErrorResponce(res, "Please enter a valid e-mail");
    }

    const user = await Users.findOne({ email });

    if (!user) {
      return SendErrorResponce(res, "User does not exists.");
    }

    const isMatchPassword = await bcrypt.compare(password, user.password);

    if (!isMatchPassword) {
      return SendErrorResponce(res, "Password does not match.");
    }

    const refresh_token = Refresh_token({ id: user._id });

    res.setHeader(
      "Set-Cookie",
      `refresh_token=${refresh_token}; max-age=${
        7 * 24 * 60 * 60 * 1000
      }; path=/api/user/refresh_token; HttpOnly, Secure`
    );

    await Users.findByIdAndUpdate(user._id, { rf_token: refresh_token });

    res.writeHead(200, { "Content-type": "application/json" });
    return res.end(JSON.stringify({ msg: "Login Success!" }));
  } catch (error) {
    return SendErrorResponce(res, error.message);
  }
}
async function logout(req, res) {
  try {
    const token = req.headers.authorization;
    if (!token) {
      return SendErrorResponce(res, "Please login now.");
    }

    const decoded = await jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    if (!decoded) {
      return SendErrorResponce(res, "Please login now.");
    }

    const user = await Users.findById(decoded.id);

    if (!user) {
      return SendErrorResponce(res, "Please login now.");
    }

    res.writeHead(200, {
      "Set-Cookie": `refresh_token=; max-age=0; path=/api/user/refresh_token; HttpOnly, Secure`,
    });
    await Users.findOneAndUpdate(
      { _id: user._id },
      {
        rf_token: "",
      }
    );
    res.writeHead(200, { "Content-type": "application/json" });
    return res.end(JSON.stringify({ msg: "Logged out." }));
  } catch (error) {
    return SendErrorResponce(res, error.message);
  }
}
async function getRefreshToken(req, res) {
  try {
    const rf_token = req.headers.cookie?.split("=")[1];

    if (!rf_token) {
      return SendErrorResponce(res, "Please login now.");
    }
    const decoded = jwt.verify(rf_token, process.env.REFRESH_TOKEN_SECRET);
    if (!decoded) {
      return SendErrorResponce(res, "Please login now.");
    }

    const user = await Users.findById(decoded.id).select("-password +rf_token");

    if (!user) {
      return SendErrorResponce(res, "This account does not exists.");
    }
    if (rf_token !== user.rf_token) {
      res.writeHead(200, {
        "Set-Cookie": `refresh_token=; max-age=0; path=/api/user/refresh_token; HttpOnly, Secure`,
      });
      return SendErrorResponce(res, "Please login now.");
    }

    const refresh_token = Refresh_token({ id: user._id });

    res.setHeader(
      "Set-Cookie",
      `refresh_token=${refresh_token}; max-age=${
        7 * 24 * 60 * 60 * 1000
      }; path=/api/user/refresh_token; HttpOnly, Secure`
    );

    await Users.findOneAndUpdate(
      { _id: user._id },
      {
        rf_token: refresh_token,
      }
    );
    const access_token = Access_token({ id: user._id });

    res.writeHead(200, { "Content-type": "application/json" });
    return res.end(JSON.stringify({ user, access_token }));
  } catch (error) {
    return SendErrorResponce(res, error.message);
  }
}

export { register, login, logout, getRefreshToken };
