import User from "../models/userModel.js";

export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select(
      "fullName email role preferences createdAt"
    );
    return res.status(200).json({ users });
  } catch (err) {
    console.error("Erreur récupération utilisateurs :", err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
};
export const deleteUser = async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Erreur récupération utilisateurs :", err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
};
export async function getImagesByUser(userId) {
  try {
    const images = await ImageHistory.find({ user: userId }).select(
      "prompt providerUsed status imageUrl createdAt"
    );
    return images;
  } catch (err) {
    console.error("Erreur récupération images :", err);
    throw new Error("Erreur lors de la récupération des images.");
  }
}
