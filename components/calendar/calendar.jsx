/*
Calendar that updates with each chore change from other pages/components and can be filtered by user, date, chore, etc.
*/

import React, { useState, useEffect } from 'react';

// update calendar to filter
const filterChoresByUser = (chores, userId) => {
  return chores.filter((chore) => chore.assigned_to === userId);
};

const filterChoresByDate = (chores, date) => {
  return chores.filter((chore) => new Date(chore.due_date).toDateString() === new Date(date).toDateString());
};

const filterChoresByChoreName = (chores, choreName) => {
  return chores.filter((chore) => chore.title.toLowerCase().includes(choreName.toLowerCase()));
};

// render calendar with filtered chores
const Calendar = () => {
  const [chores, setChores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchChores = async () => {
      try {
        const response = await fetch('/api/chores'); // Endpoint

        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        setChores(data);
      } catch (error) {
        setError(error);
      } finally {
        setLoading(false);
      }
    };

    fetchChores();
  }, []); // Empty dependency array ensures this runs only once on mount

  if (loading) {
    return <div>Loading calendar...</div>;
  }

  if (error) {
    return <div>Error fetching chores for calendar: {error.message}</div>;
  }

  return (
    <div>
      <h2>Chore Calendar</h2>
      {/* Render the calendar with chores here */}
      <ul>
        {/* Need to add filtering */}
        {chores.map((chore) => (
          <li key={chore.id}>
            <strong>{chore.title}</strong> - Assigned to: {chore.assigned_to} - Due Date: {chore.due_date}
          </li>
        ))}
      </ul>
    </div>
  );
};