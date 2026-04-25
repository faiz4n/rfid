import { User } from "../models/User.js";
import { normalizeUID } from "../utils/uid.js";

export async function createUser(req, res) {
  try {
    const { name, uid, department, role } = req.body;

    if (!name || !uid) {
      return res.status(400).json({ message: "name and uid are required" });
    }

    const normalizedUID = normalizeUID(uid);

    const existing = await User.findOne({ uid: normalizedUID });
    if (existing) {
      return res.status(409).json({ message: "UID already registered" });
    }

    const user = await User.create({
      name,
      uid: normalizedUID,
      department,
      role,
    });

    return res.status(201).json(user);
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to create user", error: error.message });
  }
}

export async function getUsers(req, res) {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    return res.json(users);
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to fetch users", error: error.message });
  }
}

export async function updateUser(req, res) {
  try {
    const { id } = req.params;
    const { name, uid, department, role } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (uid && normalizeUID(uid) !== user.uid) {
      const normalizedUID = normalizeUID(uid);
      const existing = await User.findOne({
        uid: normalizedUID,
        _id: { $ne: id },
      });
      if (existing) {
        return res.status(409).json({ message: "UID already registered" });
      }
      user.uid = normalizedUID;
    }

    if (name) user.name = name;
    if (department !== undefined) user.department = department;
    if (role) user.role = role;

    await user.save();
    return res.json(user);
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to update user", error: error.message });
  }
}

export async function blockUserCard(req, res) {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.cardStatus = "blocked";
    user.blockedAt = new Date();
    await user.save();

    return res.json({ message: "Card blocked", user });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to block card", error: error.message });
  }
}

export async function unblockUserCard(req, res) {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.cardStatus = "active";
    user.blockedAt = null;
    await user.save();

    return res.json({ message: "Card unblocked", user });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to unblock card", error: error.message });
  }
}

export async function transferUserCard(req, res) {
  try {
    const { id } = req.params;
    const { newUid } = req.body;

    if (!newUid) {
      return res.status(400).json({ message: "newUid is required" });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const normalizedUID = normalizeUID(newUid);
    const existing = await User.findOne({
      uid: normalizedUID,
      _id: { $ne: id },
    });
    if (existing) {
      return res
        .status(409)
        .json({ message: "UID already assigned to another user" });
    }

    const previousUid = user.uid;
    user.uid = normalizedUID;
    user.cardStatus = "active";
    user.blockedAt = null;
    await user.save();

    return res.json({
      message: "Card transferred successfully",
      previousUid,
      user,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to transfer card", error: error.message });
  }
}

export async function clearUserCard(req, res) {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({
      message: "User and card removed completely",
      user,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to remove user", error: error.message });
  }
}
