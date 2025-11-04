// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    document.querySelector(this.getAttribute('href')).scrollIntoView({
      behavior: 'smooth'
    });
  });
});

// Update active navigation link based on scroll position
window.addEventListener('scroll', () => {
  let current = '';
  const sections = document.querySelectorAll('section');
  const navLinks = document.querySelectorAll('.nav-links a');

  sections.forEach(section => {
    const sectionTop = section.offsetTop;
    if (scrollY >= sectionTop - 60) {
      current = section.getAttribute('id');
    }
  });

  navLinks.forEach(link => {
    link.classList.remove('active');
    if (link.getAttribute('href') === `#${current}`) {
      link.classList.add('active');
    }
  });
});

// Donation and Request buttons functionality
document.getElementById('donateBtn').addEventListener('click', async () => {
  try {
    const response = await fetch('/api/register-donor', {
      method: 'GET'
    });
    if (response.ok) {
      window.location.href = '/donate';
    }
  } catch (error) {
    console.error('Error:', error);
  }
});

document.getElementById('requestBtn').addEventListener('click', async () => {
  try {
    const response = await fetch('/api/request-blood', {
      method: 'GET'
    });
    if (response.ok) {
      window.location.href = '/request';
    }
  } catch (error) {
    console.error('Error:', error);
  }
});

// Load statistics
async function loadStats() {
  try {
    const response = await fetch('/api/stats');
    const data = await response.json();
    
    document.getElementById('donorCount').textContent = data.donors;
    document.getElementById('donationCount').textContent = data.donations;
    document.getElementById('livesSaved').textContent = data.livesSaved;
  } catch (error) {
    console.error('Error loading stats:', error);
  }
}

// Remove loading screen
window.addEventListener('load', () => {
  document.body.classList.remove('loading');
  document.querySelector('.page-loader').style.opacity = '0';
  setTimeout(() => {
    document.querySelector('.page-loader').style.display = 'none';
  }, 500);
});

// Initialize AOS
AOS.init({
  duration: 800,
  offset: 100,
  once: true,
  easing: 'ease-out'
});

// Function to format numbers
function formatNumber(number) {
  if (number >= 1000) {
    return (number / 1000).toFixed(1) + 'k';
  }
  return number.toString();
}

// Function to animate counter
function animateCounter(element, target, prefix = '', suffix = '') {
  const counter = element;
  const speed = 200;
  const increment = target / speed;
  let current = 0;

  const timer = setInterval(() => {
    current += increment;
    const formattedNumber = formatNumber(Math.floor(current));
    counter.textContent = `${prefix}${formattedNumber}${suffix}`;

    if (current >= target) {
      counter.textContent = `${prefix}${formatNumber(target)}${suffix}`;
      clearInterval(timer);
    }
  }, 1);
}

// Function to create chart
function createChart(canvasId, data) {
  const ctx = document.getElementById(canvasId).getContext('2d');
  return new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
      datasets: [{
        data: data,
        borderColor: '#e74c3c',
        borderWidth: 2,
        fill: true,
        backgroundColor: 'rgba(231, 76, 60, 0.1)',
        tension: 0.4,
        pointRadius: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        x: {
          display: false
        },
        y: {
          display: false
        }
      }
    }
  });
}

// Function to animate progress rings
function animateProgressRing(circle, percent) {
  const radius = circle.r.baseVal.value;
  const circumference = radius * 2 * Math.PI;
  circle.style.strokeDasharray = `${circumference} ${circumference}`;
  
  const offset = circumference - (percent / 100) * circumference;
  circle.style.strokeDashoffset = offset;
}

// Update blood availability cards
function updateBloodAvailability(availability) {
  const bloodGrid = document.querySelector('.blood-grid');
  bloodGrid.innerHTML = '';

  Object.entries(availability).forEach(([type, data]) => {
    const card = document.createElement('div');
    card.className = `blood-type-card ${data.level}`;
    card.setAttribute('data-aos', 'fade-up');
    card.setAttribute('data-status', data.level);
    
    card.innerHTML = `
      <span class="blood-type">${type}</span>
      <div class="availability-bar" style="--percentage: ${data.percentage}%"></div>
      <span class="status">${data.level.charAt(0).toUpperCase() + data.level.slice(1)}</span>
      <span class="percentage">${data.percentage}%</span>
    `;
    
    bloodGrid.appendChild(card);
  });
}

// Load and display stats
async function loadStats() {
  try {
    const response = await fetch('/api/stats');
    const data = await response.json();
    
    // Animate counters
    animateCounter(document.getElementById('donorCount'), data.donors.total);
    document.getElementById('donorGrowth').textContent = data.donors.growth;
    document.getElementById('activedonors').textContent = formatNumber(data.donors.active);
    
    animateCounter(document.getElementById('donationCount'), data.donations.total);
    document.getElementById('donationGrowth').textContent = data.donations.growth;
    document.getElementById('monthlyDonations').textContent = formatNumber(data.donations.thisMonth);
    
    animateCounter(document.getElementById('livesSaved'), data.livesSaved.total);
    document.getElementById('livesGrowth').textContent = data.livesSaved.growth;
    document.getElementById('impactScore').textContent = data.livesSaved.impactScore;

    // Animate progress rings
    const circles = document.querySelectorAll('.progress-ring-circle');
    circles.forEach((circle, index) => {
      const values = [
        data.donors.growth,
        data.donations.growth,
        data.livesSaved.growth
      ];
      animateProgressRing(circle, values[index]);
    });

    // Create charts with real data
    const months = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    createChart('donorChart', generateChartData(data.donors.total, 6));
    createChart('donationChart', generateChartData(data.donations.total, 6));
    createChart('livesChart', generateChartData(data.livesSaved.total, 6));

    // Update blood availability
    updateBloodAvailability(data.bloodAvailability);

  } catch (error) {
    console.error('Error loading stats:', error);
  }
}

// Helper function to generate chart data
function generateChartData(total, months) {
  const data = [];
  let current = total * 0.7;
  for (let i = 0; i < months; i++) {
    current *= (1 + (Math.random() * 0.1));
    data.push(Math.round(current));
  }
  data[data.length - 1] = total;
  return data;
}

// Load stats when page loads
loadStats();

// Modal handling
const loginModal = document.getElementById('loginModal');
const signupModal = document.getElementById('signupModal');
const loginBtn = document.getElementById('loginBtn');
const signupBtn = document.getElementById('signupBtn');
const closeBtns = document.querySelectorAll('.close');
const switchToSignup = document.getElementById('switchToSignup');
const switchToLogin = document.getElementById('switchToLogin');
const menuToggle = document.querySelector('.menu-toggle');
const navLinks = document.querySelector('.nav-links');

// Toggle mobile menu
menuToggle.addEventListener('click', () => {
  navLinks.classList.toggle('active');
});

// Modal opening
loginBtn.addEventListener('click', () => {
  loginModal.style.display = 'block';
});

signupBtn.addEventListener('click', () => {
  signupModal.style.display = 'block';
});

// Modal closing
closeBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    loginModal.style.display = 'none';
    signupModal.style.display = 'none';
  });
});

window.addEventListener('click', (e) => {
  if (e.target === loginModal || e.target === signupModal) {
    loginModal.style.display = 'none';
    signupModal.style.display = 'none';
  }
});

// Switch between modals
switchToSignup.addEventListener('click', (e) => {
  e.preventDefault();
  loginModal.style.display = 'none';
  signupModal.style.display = 'block';
});

switchToLogin.addEventListener('click', (e) => {
  e.preventDefault();
  signupModal.style.display = 'none';
  loginModal.style.display = 'block';
});

// Form handling
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;

  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();
    if (response.ok) {
      showToast('Login successful!', 'success');
      loginModal.style.display = 'none';
      updateUIForLoggedInUser(data.user);
    } else {
      showToast(data.message || 'Login failed', 'error');
    }
  } catch (error) {
    showToast('An error occurred', 'error');
  }
});

document.getElementById('signupForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('signupName').value;
  const email = document.getElementById('signupEmail').value;
  const password = document.getElementById('signupPassword').value;
  const bloodType = document.getElementById('bloodType').value;
  const isDonor = document.getElementById('isDonor').checked;

  try {
    const response = await fetch('/api/signup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name, email, password, bloodType, isDonor })
    });

    const data = await response.json();
    if (response.ok) {
      showToast('Registration successful!', 'success');
      signupModal.style.display = 'none';
      updateUIForLoggedInUser(data.user);
    } else {
      showToast(data.message || 'Registration failed', 'error');
    }
  } catch (error) {
    showToast('An error occurred', 'error');
  }
});

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}

function updateUIForLoggedInUser(user) {
  const authButtons = document.querySelector('.auth-buttons');
  authButtons.innerHTML = `
    <span class="user-name">Welcome, ${user.name}</span>
    <button id="logoutBtn" class="btn-outline">Logout</button>
  `;

  document.getElementById('logoutBtn').addEventListener('click', () => {
    fetch('/api/logout', { method: 'POST' })
      .then(() => {
        showToast('Logged out successfully', 'success');
        location.reload();
      })
      .catch(() => {
        showToast('Error logging out', 'error');
      });
  });
}
