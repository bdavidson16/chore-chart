/**
Shows a notification to the user when they are assigned a chore.

Bell at the top of the page drops down list of notifications. Each notification has a link to the chore details page. The user can click on the notification to view the chore details.
 */

const notifyUser = (userId, choreName) => {
  // This function would contain the logic to notify the user, e.g., sending an email or a push notification.
  console.log(`User ${userId} has been assigned the chore: ${choreName}`);
};

const notificationList = document.getElementById('notification-list');

if (notificationList) {
  const notificationItem = document.createElement('li');
  notificationItem.textContent = `You have been assigned the chore: ${choreName}`;
  notificationList.appendChild(notificationItem);
}

export default notifyUser;