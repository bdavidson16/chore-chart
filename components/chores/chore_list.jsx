/*
Shows available chores with needed due dates, sorted by priority. The user can mark chores as completed, and the points will be calculated based on the frequency of the chore and the number of days since the last completion. The points are then updated in the user's profile.
*/

// Plus (+) sign next to chore to assign user to the chore. The user will receive a notification when they are assigned a chore.
const assignChoreToUser = async (choreId, userId) => {
  try {
    const response = await fetch(`/api/chores/${choreId}/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error assigning chore to user:', error);
  }
};

const sortChoresByPriority = (chores) => {
  return chores.sort((a, b) => {
    const priorityOrder = { high: 1, medium: 2, low: 3 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
};

const sortChoresByDueDate = (chores) => {
  return chores.sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
};

const filterChoresByCompletion = (chores, completed) => {
  return chores.filter((chore) => chore.completed === completed);
};

const filterChoresByAssignedUser = (chores, userId) => {
  return chores.filter((chore) => chore.assigned_to === userId);
};

const ChoreList = () => {
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