import User from '../models/userModel.js';
import jwt from 'jsonwebtoken';
import { generateAccessToken, generateRefreshToken, generateResetCode } from '../utils/generateTokens.js';
import { loginSchema, registerSchema, verifyCodeSchema } from '../schemas/authSchema.js';
import { sendResetCodeEmail } from '../utils/emailSender.js';

export const register = async (req, res) => {
  const { fullName, email, password, role = "user" } = req.body;

  const { error } = registerSchema.validate({ fullName, email, password }, { abortEarly: false });
  if (error) {
    const formattedErrors = error.details.map((err) => ({
      message: err.message,
      path: err.path,
    }));

    return res.status(400).json({
      error: {
        details: {
          errors: formattedErrors,
        },
      },
    });
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        error: {
          details: {
            errors: [
              {
                message: "Email already in use",
                path: ["email"],
              },
            ],
          },
        },
      });
    }

    const user = await User.create({ fullName, email, password, role });

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("Registration error:", err);
    return res.status(500).json({
      error: {
        details: {
          errors: [
            {
              message: "Server error",
              path: ["toast"],
            },
          ],
        },
      },
    });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;
  const { error } = loginSchema.validate({ email, password }, { abortEarly: false });
  if (error) {
    const formattedErrors = error.details.map((err) => ({
      message: err.message,
      path: err.path,
    }));

    return res.status(400).json({
      error: {
        details: {
          errors: formattedErrors,
        },
      },
    });
  }
  try {
    const user = await User.findOne({ email });

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({
        error: {
          details: {
            errors: [
              {
                message: "Incorrect email or password",
                path: ["toast"],
              },
            ],
          },
        },
      });
    }

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    user.refreshToken = refreshToken;
    await user.save();

    res
      .cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      })
      .json({
        success: true,
        accessToken,
        user: {
          id: user._id,
          email: user.email,
          fullName: user.fullName,
        },
      });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({
      error: {
        details: {
          errors: [
            {
              message: "Server error",
              path: ["toast"],
            },
          ],
        },
      },
    });
  }
};

export const refresh = async (req, res) => {
  const token = req.cookies.refreshToken;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "No token provided",
    });
  }

  try {
    const payload = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
    const user = await User.findById(payload.userId);

    if (!user || user.refreshToken !== token) {
      return res.status(403).json({
        success: false,
        message: "Invalid or revoked token",
      });
    }

    const newAccessToken = generateAccessToken(user._id);

    return res.status(200).json({
      success: true,
      accessToken: newAccessToken,
    });
  } catch (err) {
    console.error("Refresh token error:", err.message);
    return res.status(403).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

export const logout = async (req, res) => {
  try {
    const token = req.cookies.refreshToken;

    if (token) {
      try {
        const payload = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
        await User.findByIdAndUpdate(payload.userId, { refreshToken: null });
      } catch (err) {
        console.error('Token verification error during logout:', err);
      }
    }

    res
      .clearCookie('refreshToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
      })
      .json({ 
        success: true,
        message: 'Logout successful' 
      });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error during logout' 
    });
  }
};

export const requestPasswordReset = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        error: {
          details: {
            errors: [{
              message: "No account found with that email",
              path: ["email"]
            }]
          }
        }
      });
    }

    // Check if a valid code already exists and hasn't expired
    const hasValidCode = user.resetPasswordCode && 
                        user.resetPasswordCodeExpires > Date.now();

    if (hasValidCode) {
      return res.status(200).json({
        success: true,
        message: "A valid code already exists",
        code: user.resetPasswordCode // Optional: for development
      });
    }

    // Generate a new code only if needed
    const resetCode = generateResetCode();
    user.resetPasswordCode = resetCode;
    user.resetPasswordCodeExpires = Date.now() + 3600000; // 1 hour

    await user.save();
    await sendResetCodeEmail(user.email, resetCode);

    res.status(200).json({ 
      success: true,
      message: 'Reset code sent'
    });

  } catch (err) {
    console.error("Password reset request error:", err);
    res.status(500).json({
      error: {
        details: {
          errors: [{
            message: "Server error",
            path: ["toast"]
          }]
        }
      }
    });
  }
};

export const verifyResetCode = async (req, res) => {
  const { email, code } = req.body;
  const { error } = verifyCodeSchema.validate({ email, code }, { abortEarly: false });

  if (error) {
    const formattedErrors = error.details.map((err) => ({
      message: err.message,
      path: err.path,
    }));

    return res.status(400).json({
      error: {
        details: {
          errors: formattedErrors,
        },
      },
    });
  }

  try {
    const user = await User.findOne({ email });

    if (!user || !user.resetPasswordCode || user.resetPasswordCode !== code) {
      return res.status(400).json({
        error: {
          details: {
            errors: [{
              message: "Invalid code",
              path: ["code"]
            }]
          }
        }
      });
    }

    if (user.resetPasswordCodeExpires < Date.now()) {
      return res.status(400).json({
        error: {
          details: {
            errors: [{
              message: "Code expired",
              path: ["code"]
            }]
          }
        }
      });
    }

    // Create a temporary token for next step
    const tempToken = jwt.sign(
      { email, code },
      process.env.RESET_TOKEN_SECRET,
      { expiresIn: '5m' }
    );

    res.status(200).json({
      success: true,
      tempToken,
      message: "Code verified successfully"
    });

  } catch (err) {
    console.error("Code verification error:", err);
    res.status(500).json({
      error: {
        details: {
          errors: [{
            message: "Server error",
            path: ["toast"]
          }]
        }
      }
    });
  }
};

// Password reset
export const resetPassword = async (req, res) => {
  const { tempToken, newPassword } = req.body;

  try {
    const decoded = jwt.verify(tempToken, process.env.RESET_TOKEN_SECRET);
    const { email, code } = decoded;

    const user = await User.findOne({
      email,
      resetPasswordCode: code
    });

    if (!user) {
      return res.status(400).json({
        error: {
          details: {
            errors: [{
              message: "Invalid session",
              path: ["toast"]
            }]
          }
        }
      });
    }

    // Reset password
    user.password = newPassword;
    user.resetPasswordCode = undefined;
    user.resetPasswordCodeExpires = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Password updated"
    });

  } catch (err) {
    console.error("Password reset error:", err);
    res.status(500).json({
      error: {
        details: {
          errors: [{
            message: "Server error",
            path: ["toast"]
          }]
        }
      }
    });
  }
};

export const getEmailByCode = async (req, res) => {
  const { code } = req.params;
  try {
    const user = await User.findOne({ resetPasswordCode: code });
    if (!user) {
      return res.status(400).json({
        error: {
          details: {
            errors: [{
              message: "Invalid code",
              path: ["code"]
            }]
          }
        }
      });
    }
    res.status(200).json({
      success: true,
      email: user.email,
      message: "Email found"
    });
  } catch (err) {
    console.error("Email by code error:", err);
    res.status(500).json({
      error: {
        details: {
          errors: [{
            message: "Server error",
            path: ["toast"]
          }]
        }
      }
    });
  }
};
