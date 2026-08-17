/*
Shows details for a specific chore.
*/

import { useState, useRef, useEffect } from 'react';

const choreName = useRef(null);
const choreDescription = useRef(null);
const choreDueDate = useRef(null);
const choreAssignedTo = useRef(null);
const choreCompleted = useRef(null);
const choreId = useRef(null);
const choreFrequency = useRef(null);
const chorePoints = useRef(null);
const choreLastCompleted = useRef(null);
const [choreDetails, setChoreDetails] = useState(null);
const [isLoading, setIsLoading] = useState(true);
const [error, setError] = useState(null);

// Fetch chore details from the API
useEffect(() => {
  const fetchChoreDetails = async () => {
    try {
      const response = await fetch(`/api/chores/${choreId.current}`);
      if (!response.ok) {
        throw new Error('Failed to fetch chore details');
      }
      const data = await response.json();
      setChoreDetails(data);
    } catch (error) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  fetchChoreDetails();
}, [choreId.current]);

// Set chore frequency based on the selected option
useEffect(() => {
  if (choreFrequency.current) {
    const frequency = choreFrequency.current.value;
    setChoreDetails((prevDetails) => ({
      ...prevDetails,
      frequency: frequency,
    }));
  }
}, [choreFrequency.current]);

// Render the chore details
useEffect(() => {
  if (choreDetails) {
    choreName.current.value = choreDetails.name;
    choreDescription.current.value = choreDetails.description;
    choreDueDate.current.value = choreDetails.dueDate;
    choreAssignedTo.current.value = choreDetails.assignedTo;
    choreCompleted.current.checked = choreDetails.completed;
    choreFrequency.current.value = choreDetails.frequency;
    chorePoints.current.value = choreDetails.points;
    choreLastCompleted.current.value = choreDetails.lastCompleted;
  }
}, [choreDetails]);

if (isLoading) {
  return <div>Loading...</div>;
}

if (error) {
  return <div>Error: {error}</div>;
}

// update point bar
const updatePointBarUI = (points) => {
    const pointBar = document.getElementById('point-bar');
    if (pointBar) {
        pointBar.style.width = `${points}%`;
        pointBar.textContent = `${points} points`;
    }
};

// update point bar dependent on selected user
useEffect(() => {
  const updatePointBar = async () => {
    if (choreAssignedTo.current) {
      const userId = choreAssignedTo.current.value;
      try {
        const response = await fetch(`/api/users/${userId}/points`);
        if (!response.ok) {
          throw new Error('Failed to fetch user points');
        }
        const data = await response.json();
        // Update the point bar with the fetched data
        // Assuming you have a function to update the point bar
        updatePointBarUI(data.points);
      } catch (error) {
        console.error('Error fetching user points:', error);
      }
    }
  };

  updatePointBar();
}, [choreAssignedTo.current]);

return (
  <div>
    <h2>{choreDetails.name}</h2>
    <p>{choreDetails.description}</p>
    <p>Due Date: {choreDetails.dueDate}</p>
    <p>Assigned To: {choreDetails.assignedTo}</p>
    <p>Completed: {choreDetails.completed ? 'Yes' : 'No'}</p>
    <p>Frequency: {choreDetails.frequency}</p>
    <p>Points: {choreDetails.points}</p>
    <p>Last Completed: {choreDetails.lastCompleted}</p>
  </div>
);

