const investment = {
  id: null,
  userId: '',
  itemId: '',        // Added: To track which product was bought
  dailyEarning: 0.00,
  totalEarning: 0.00,
  startDate: new Date(), // Changed: Matches the new 'start_date' column
  status: 'active'       // Added: Matches the new 'status' column
};
