import {useState, useEffect} from 'react';
import ObservableState from './ObservableState';

export default function useObservableState<T>(
  observable: ObservableState<T>,
): T {
  const [state, setState] = useState(observable.getValue());
  useEffect(() => {
    return observable.subscribe(setState);
  }, []);
  return state;
}
