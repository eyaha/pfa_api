import User from "../models/userModel.js";

export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select(
      "fullName email role preferences createdAt"
    );
    return res.status(200).json({ users });
  } catch (err) {
    console.error("Error fetching users:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const deleteUser = async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Error deleting user:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export async function getImagesByUser(userId) {
  try {
    const images = await ImageHistory.find({ user: userId }).select(
      "prompt providerUsed status imageUrl createdAt"
    );
    return images;
  } catch (err) {
    console.error("Error fetching images:", err);
    throw new Error("Error retrieving images.");
  }
}
