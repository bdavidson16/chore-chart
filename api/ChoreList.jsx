import React, { useState, useEffect } from 'react';

const ChoreList = () => {
  const [chores, setChores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchChores = async () => {
      try {
        const response = await fetch('/apps/choretracker/api/chores'); // Endpoint

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
    return <div>Loading chores...</div>;
  }

  if (error) {
    return <div>Error fetching chores: {error.message}</div>;
  }

  return (
    <ul>
      {chores.map((chore) => (
        <li key={chore.id}>
          <strong>{chore.title}</strong> - Assigned to: {chore.assigned_to} - Due Date: {chore.due_date}
        </li>
      ))}
    </ul>
  );
};

export default ChoreList;