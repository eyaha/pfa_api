import User from '../models/user.model.js';
import jwt from 'jsonwebtoken';
import { generateAccessToken, generateRefreshToken, generateResetCode } from '../utils/generateTokens.js';
import { loginSchema, passwordResetSchema, registerSchema, verifyCodeSchema } from '../schemas/authSchema.js';
import { sendResetCodeEmail } from '../utils/emailSender.js';

export const register = async (req, res) => {
  const { fullName, email, password } = req.body;
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
                message: "Email déjà utilisé",
                path: ["email"],
              },
            ],
          },
        },
      });
    }
    const user = await User.create({ fullName, email, password });

    return res.status(201).json({
      success: true,
      message: "Utilisateur inscrit avec succès",
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
      },
    });
  } catch (err) {
    console.error("Registration error:", err);
    return res.status(500).json({
      error: {
        details: {
          errors: [
            {
              message: "Erreur serveur",
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
                message: "Email ou mot de passe incorrect",
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
              message: "Erreur serveur",
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
      message: 'Aucun token fourni' 
    });
  }

  try {
    const payload = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
    const user = await User.findById(payload.userId);
    
    if (!user || user.refreshToken !== token) {
      return res.status(403).json({ 
        success: false,
        message: 'Token invalide' 
      });
    }

    const newAccessToken = generateAccessToken(user._id);
    
    res.json({ 
      success: true,
      accessToken: newAccessToken 
    });

  } catch (err) {
    console.error('Refresh token error:', err);
    res.status(403).json({ 
      success: false,
      message: 'Token invalide ou expiré'
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
        message: 'Déconnexion réussie' 
      });

  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Erreur serveur lors de la déconnexion' 
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
              message: "Aucun compte trouvé avec cet email",
              path: ["email"]
            }]
          }
        }
      });
    }

    // Vérifie si un code existe déjà et n'a pas expiré
    const hasValidCode = user.resetPasswordCode && 
                        user.resetPasswordCodeExpires > Date.now();

    if (hasValidCode) {
      return res.status(200).json({
        success: true,
        message: "Un code valide existe déjà",
        code: user.resetPasswordCode // Optionnel: pour le développement
      });
    }

    // Génère un nouveau code seulement si nécessaire
    const resetCode = generateResetCode();
    user.resetPasswordCode = resetCode;
    user.resetPasswordCodeExpires = Date.now() + 3600000; // 1h
    
    await user.save();
    await sendResetCodeEmail(user.email, resetCode);

    res.status(200).json({ 
      success: true,
      message: 'Code de réinitialisation envoyé'
    });

  } catch (err) {
    console.error("Reset request error:", err);
    res.status(500).json({
      error: {
        details: {
          errors: [{
            message: "Erreur serveur",
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

  // Validation des données
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
              message: "Code invalide",
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
              message: "Code expiré",
              path: ["code"]
            }]
          }
        }
      });
    }

    // Crée un token temporaire pour l'étape suivante
    const tempToken = jwt.sign(
      { email, code },
      process.env.RESET_TOKEN_SECRET,
      { expiresIn: '5m' }
    );

    res.status(200).json({
      success: true,
      tempToken,
      message: "Code vérifié avec succès"
    });

  } catch (err) {
    console.error("Code verification error:", err);
    res.status(500).json({
      error: {
        details: {
          errors: [{
            message: "Erreur serveur",
            path: ["toast"]
          }]
        }
      }
    });
  }
};

// Réinitialisation du mot de passe
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
              message: "Session invalide",
              path: ["toast"]
            }]
          }
        }
      });
    }

    // Réinitialisation
    user.password = newPassword;
    user.resetPasswordCode = undefined;
    user.resetPasswordCodeExpires = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Mot de passe mis à jour"
    });

  } catch (err) {
    console.error("Password reset error:", err);
    res.status(500).json({
      error: {
        details: {
          errors: [{
            message: "Erreur serveur",
            path: ["toast"]
          }]
        }
      }
    });
  }
};