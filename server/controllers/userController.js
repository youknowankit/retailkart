import { User } from "../models/userModel.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { verifyEmail } from "../email/verifyEmail.js";

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
