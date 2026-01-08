import { User } from "../models/userModel.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { verifyEmail } from "../email/verifyEmail.js";

//REGISTER CONTROLLER
export const register = async (req, res) => {
  try {
    //check if anything is missing
    const { firstName, lastName, email, password } = req.body;
    if (!firstName || !lastName || !email || !password) {
      res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    //check if user already exists in database
    const user = await User.findOne({ email });
    if (user) {
      res.status(400).json({
        success: false,
        message: "User already exists",
      });
    }

    //HASHING/ENCRYPTING PASSWORD USING BCRYPTJS
    const hashedPassword = await bcrypt.hash(password, 10);

    //All good then we create a user with required details
    const newUser = await User.create({
      firstName,
      lastName,
      email,
      password: hashedPassword,
    });

    //GENERATE TOKEN FOR EMAIL VERIFICATION
    const token = jwt.sign({ id: newUser._id }, process.env.SECRET_KEY, {
      expiresIn: "10m",
    });
    verifyEmail(token, email); //send Email for verification
    //We pass the token to new user
    newUser.token = token;

    //await user creation as it takes time
    await newUser.save();

    //return a success with response as well as the newUser
    return res.status(201).json({
      success: true,
      message: "User registered successfully!",
      user: newUser,
    });
  } catch (error) {
    //status 500: for internal server error
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

//VERIFY CONTROLLER
export const verify = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(400).json({
        success: false,
        message: "Auth Token is missing or invalid",
      });
    }

    /*AuthHeader looks like 
    "[Bearer asds23adasdasd....]-Array" 
    index=0=>Bearer 
    index=1 =>token(asds23adasdasd....)
    
    So, basically we are extracting a token
    */
    const token = authHeader.split(" ")[1];

    let decoded;
    try {
      /*Verify the token| Decoded will have a value of 
      payload which we passed earlier i.e. id (in usercontroller)*/
      decoded = jwt.verify(token, process.env.SECRET_KEY);
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        return res.status(400).json({
          success: false,
          message: "The registration token has expired!",
        });
      }
      return res.status(400).json({
        success: false,
        message: "Token verification failed.",
      });
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "User not found",
      });
    }
    user.token = null;
    user.isVerified = true;
    await user.save();
    return res.status(200).json({
      success: true,
      message: "Email verified successfully!",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

//RE-VERIFY CONTROLLER
export const reVerify = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "User not found",
      });
    }

    const token = jwt.sign({ id: user._id }, process.env.SECRET_KEY, {
      expiresIn: "10m",
    });
    verifyEmail(token, email); //send Email for verification
    user.token = token;
    await user.save();
    return res.status(200).json({
      success: true,
      message: "Verification email resent successfully.",
      token: user.token,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

//LOGIN CONTROLLER
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    const existingUser = await User.findOne({ email });
    if (!existingUser) {
      return res.status(400).json({
        success: false,
        message: "User does not exist",
      });
    }

    const isPasswordValid = await bcrypt.compare(
      password,
      existingUser.password
    );

    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid Credentials",
      });
    }

    if (existingUser.isVerified === false) {
      return res.status(400).json({
        success: false,
        message: "Verify your account then login",
      });
    }

    //Generate Access token & reference Token
    const accessToken = jwt.sign(
      { id: existingUser._id },
      process.env.SECRET_KEY,
      { expiresIn: "10d" }
    );
    const refreshToken = jwt.sign(
      { id: existingUser._id },
      process.env.SECRET_KEY,
      { expiresIn: "30d" }
    );

    existingUser.isLoggedIn = true;
    await existingUser.save();

    //Check for existing Session
    const existingSession = await Session.findOne({ userId: existingUser._id });
    if (existingSession) {
      await Session.deleteOne({ userId: existingUser._id });
    }

    //create a new session for user
    await Session.create({ userId: existingUser._id });
    return res.status(200).json({
      success: true,
      message: `Welcome back ${existingUser.firstName}`,
      user: existingUser,
      accessToken,
      refreshToken,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
