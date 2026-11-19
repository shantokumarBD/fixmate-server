// Valid booking status transitions as per Assignment PDF Challenge 3
export const VALID_TRANSITIONS = {
  requested: ["accepted", "rejected", "cancelled"],
  accepted: ["in-progress"],
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