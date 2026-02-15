import type { Express } from "express";
import { z } from "zod";
import { authStorage } from "./storage";
import { isAuthenticated } from "./middleware";

const updateProfileSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(50),
  lastName: z.string().max(50).default(""),
});

export function registerAuthRoutes(app: Express): void {
  // Get current authenticated user profile
  app.get("/api/auth/user", isAuthenticated, async (req, res) => {
    try {
      const userId = req.supabaseUser!.id;
      const user = await authStorage.getUser(userId);

      if (!user) {
        // User authenticated with Supabase but not yet in our DB — auto-create
        const newUser = await authStorage.upsertUser({
          id: userId,
          email: req.supabaseUser!.email || null,
          firstName: null,
          lastName: null,
          profileImageUrl: null,
        });
        res.json(newUser);
        return;
      }

      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Update user profile
  app.patch("/api/auth/profile", isAuthenticated, async (req, res) => {
    try {
      const userId = req.supabaseUser!.id;
      const parsed = updateProfileSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid input" });
        return;
      }

      const updatedUser = await authStorage.updateProfile(userId, {
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
      });

      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Sync user from Supabase auth into our database
  // Called from the client after a successful Supabase login
  app.post("/api/auth/sync", isAuthenticated, async (req, res) => {
    try {
      const userId = req.supabaseUser!.id;
      const email = req.supabaseUser!.email;

      const user = await authStorage.upsertUser({
        id: userId,
        email: email || null,
        firstName: req.body.firstName || null,
        lastName: req.body.lastName || null,
        profileImageUrl: req.body.avatarUrl || null,
      });

      res.json(user);
    } catch (error) {
      console.error("Error syncing user:", error);
      res.status(500).json({ message: "Failed to sync user" });
    }
  });
}
