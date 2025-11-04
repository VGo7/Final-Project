const users = [
  {
    id: 1,
    name: "John Doe",
    email: "john@example.com",
    password: "password123", // In production, this would be hashed
    bloodType: "A+",
    isDonor: true,
    donationHistory: [
      { date: "2025-10-15", location: "Central Hospital" }
    ]
  },
  {
    id: 2,
    name: "Jane Smith",
    email: "jane@example.com",
    password: "password456",
    bloodType: "O-",
    isDonor: true,
    donationHistory: [
      { date: "2025-09-20", location: "City Medical Center" }
    ]
  }
];

const bloodRequests = [
  {
    id: 1,
    patientName: "Michael Brown",
    bloodType: "B+",
    units: 2,
    hospital: "Metro Hospital",
    urgency: "High",
    status: "Active",
    date: "2025-11-03"
  },
  {
    id: 2,
    patientName: "Sarah Wilson",
    bloodType: "A-",
    units: 1,
    hospital: "Central Hospital",
    urgency: "Medium",
    status: "Fulfilled",
    date: "2025-10-28"
  }
];

module.exports = {
  users,
  bloodRequests
};