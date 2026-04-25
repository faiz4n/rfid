import { Router } from "express";
import {
  blockUserCard,
  clearUserCard,
  createUser,
  getUsers,
  transferUserCard,
  unblockUserCard,
  updateUser,
} from "../controllers/userController.js";

const router = Router();

router.get("/", getUsers);
router.post("/", createUser);
router.patch("/:id", updateUser);
router.post("/:id/block", blockUserCard);
router.post("/:id/unblock", unblockUserCard);
router.post("/:id/transfer-card", transferUserCard);
router.post("/:id/clean-card", clearUserCard);

export default router;
