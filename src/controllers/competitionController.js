import Competition from '../models/Competition.js'; // Adjust path as needed
// Assuming a helper to connect to DB is handled in server.js or elsewhere,
// but for robustness, it's often good to ensure connection is checked.
// For a standard Express setup using Mongoose, connecting once in server.js is common.

// --- GET ALL COMPETITIONS ---
export const getAllCompetitions = async (req, res) => {
  try {
    // .find({}) returns all documents
    const competitions = await Competition.find({}).lean();
    res.status(200).json(competitions);
  } catch (error) {
    console.error("❌ Error fetching competitions:", error);
    res.status(500).json({ error: "Failed to fetch competitions" });
  }
};

// --- GET COMPETITION BY ID ---
export const getCompetitionById = async (req, res) => {
  try {
    const { id } = req.params;
    // Find by Mongoose ID
    const competition = await Competition.findById(id).lean();

    if (!competition) {
      return res.status(404).json({ error: "Competition not found" });
    }

    res.status(200).json(competition);
  } catch (error) {
    console.error("❌ Error fetching competition by ID:", error);
    // Handle invalid ID format (e.g., Mongoose CastError)
    if (error.name === 'CastError') {
      return res.status(400).json({ error: "Invalid competition ID format" });
    }
    res.status(500).json({ error: "Failed to fetch competition" });
  }
};

// --- CREATE NEW COMPETITION (POST) ---
export const createCompetition = async (req, res) => {
  try {
    const newCompetition = new Competition(req.body);
    const savedCompetition = await newCompetition.save();
    res.status(201).json(savedCompetition);
  } catch (error) {
    console.error("❌ Error creating competition:", error);
    // Handle validation errors (e.g., missing required fields)
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: "Failed to create competition" });
  }
};

// --- UPDATE COMPETITION (PUT/PATCH) ---
export const updateCompetition = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Use findByIdAndUpdate for atomic update
    const updatedCompetition = await Competition.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true } // {new: true} returns the updated document
    ).lean();

    if (!updatedCompetition) {
      return res.status(404).json({ error: "Competition not found" });
    }

    res.status(200).json(updatedCompetition);
  } catch (error) {
    console.error("❌ Error updating competition:", error);
    if (error.name === 'CastError') {
      return res.status(400).json({ error: "Invalid competition ID format" });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: "Failed to update competition" });
  }
};

// --- DELETE COMPETITION ---
export const deleteCompetition = async (req, res) => {
  try {
    const { id } = req.params;

    // Find and remove the document
    const deletedCompetition = await Competition.findByIdAndDelete(id);

    if (!deletedCompetition) {
      return res.status(404).json({ error: "Competition not found" });
    }

    // Return a 204 No Content or 200 with a message
    res.status(200).json({ message: "Competition deleted successfully" });
  } catch (error) {
    console.error("❌ Error deleting competition:", error);
    if (error.name === 'CastError') {
      return res.status(400).json({ error: "Invalid competition ID format" });
    }
    res.status(500).json({ error: "Failed to delete competition" });
  }
};