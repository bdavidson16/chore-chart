/*
Assigns points to users for each chore completed

The points are based on the frequency of the chore and the number of days since the last completion. The points are calculated as follows:
- Daily chores: 10 points
- Weekly chores: 5 points
- Monthly chores: 2 points

The points are then multiplied by the number of days since the last completion, up to a maximum of 30 days. For example, if a daily chore was last completed 3 days ago, the user would receive 30 points (10 points * 3 days). If a weekly chore was last completed 10 days ago, the user would receive 50 points (5 points * 10 days). If a monthly chore was last completed 40 days ago, the user would receive 60 points (2 points * 30 days).

*/

const calculatePoints = (frequency, lastCompleted) => {
  const now = new Date();
  const lastCompletedDate = new Date(lastCompleted);
  const daysSinceLastCompletion = Math.floor((now - lastCompletedDate) / (1000 * 60 * 60 * 24));

  let basePoints;
  switch (frequency) {
    case 'daily':
      basePoints = 10;
      break;
    case 'weekly':
      basePoints = 5;
      break;
    case 'monthly':
      basePoints = 2;
      break;
    default:
      basePoints = 0;
  }

  const points = basePoints * Math.min(daysSinceLastCompletion, 30);
  return points;
};

const updateUserPoints = async (userId, points) => {
  try {
    const response = await fetch(`/api/users/${userId}/points`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ points }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error updating user points:', error);
  }
};

const handleChoreCompletion = async (userId, frequency, lastCompleted) => {
  const points = calculatePoints(frequency, lastCompleted);
  await updateUserPoints(userId, points);
};

const notifyUser = (userId, choreName) => {
  // This function would contain the logic to notify the user, e.g., sending an email or a push notification.
  console.log(`User ${userId} has been assigned the chore: ${choreName}`);
};

const updatePointBarUI = (points) => {
  const pointBar = document.getElementById('point-bar');
  if (pointBar) {
    pointBar.style.width = `${points}%`;
    pointBar.textContent = `${points} points`;
  }
};

// animations when updating point bar
// negative points should be red, positive points should be green
// removing points should be animated to the left, adding points should be animated to the right
const removePointsAnimation = (points) => {
  const pointBar = document.getElementById('point-bar');
  if (pointBar) {
    pointBar.style.transition = 'width 0.5s ease-in-out';
    pointBar.style.width = `${points}%`;
    pointBar.style.backgroundColor = 'red';
    setTimeout(() => {
      pointBar.style.backgroundColor = '';
    }, 500);
  }
};

const addPointsAnimation = (points) => {
  const pointBar = document.getElementById('point-bar');
  if (pointBar) {
    pointBar.style.transition = 'width 0.5s ease-in-out';
    pointBar.style.width = `${points}%`;
    pointBar.style.backgroundColor = 'green';
    setTimeout(() => {
      pointBar.style.backgroundColor = '';
    }, 500);
  }
};

export { calculatePoints, updateUserPoints, handleChoreCompletion, notifyUser, updatePointBarUI, removePointsAnimation, addPointsAnimation };