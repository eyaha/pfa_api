import Joi from "joi";

export const registerSchema = Joi.object({
  fullName: Joi.string().min(2).required().messages({
    "string.empty": "Le nom complet est requis",
    "string.min": "Le nom complet doit contenir au moins 2 caractères"
  }),
  email: Joi.string().email().required().messages({
    "string.empty": "L'email est requis",
    "string.email": "L'email doit être valide"
  }),
  password: Joi.string().min(8).required().messages({
    "string.empty": "Le mot de passe est requis",
    "string.min": "Le mot de passe doit contenir au moins 8 caractères"
  }),
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    "string.empty": "L'email est requis",
    "string.email": "L'email doit être valide"
  }),
  password: Joi.string().min(8).required().messages({
    "string.empty": "Le mot de passe est requis",
    "string.min": "Le mot de passe doit contenir au moins 8 caractères"
  }),
})
export const passwordResetSchema = Joi.object({
  email: Joi.string()
    .email({ tlds: { allow: false } })
    .required()
    .messages({
      'string.email': 'Email invalide',
      'string.empty': 'L\'email est requis',
    }),
});
export const verifyCodeSchema = Joi.object({
  email: Joi.string().email().required(),
  code: Joi.string().length(6).required()
});

export const resetPasswordSchema = Joi.object({
  email: Joi.string().email().required(),
  code: Joi.string().length(6).required(),
  newPassword: Joi.string().min(8).required()
});

