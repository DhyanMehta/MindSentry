import { useMemo, useState } from 'react';

export const useCheckInState = () => {
  const [mood, setMood] = useState('Calm');
  const [note, setNote] = useState('');

  const moods = useMemo(() => ['Calm', 'Happy', 'Focused', 'Stressed', 'Tired'], []);

  return {
    mood,
    moods,
    note,
    setMood,
    setNote,
  };
};
