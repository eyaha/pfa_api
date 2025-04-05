import User from '../models/user.model.js';
import jwt from 'jsonwebtoken';
import { generateAccessToken, generateRefreshToken } from '../utils/generateTokens.js';
import { loginSchema, registerSchema } from '../schemas/authSchema.js';

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