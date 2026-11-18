// Valid booking status transitions as per Challenge 3 requirement

export const VALID_TRANSITIONS = {
  requested: ["accepted", "rejected", "cancelled"],
  accepted: ["in-progress", "cancelled"],
  "in-progress": ["completed"],
  completed: [],
  rejected: [],
  cancelled: [], 
};

// Helper function to check if a status change is allowed
export const isValidTransition = (currentStatus, newStatus) => {
  const allowedNextStatuses = VALID_TRANSITIONS[currentStatus] || [];
  return allowedNextStatuses.includes(newStatus);
};