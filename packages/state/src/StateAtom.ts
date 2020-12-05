import ObservableState from './ObservableState';

export default function createStateAtom<T>(
  initialValue: T,
): [ObservableState<T>, (updatedValue: T | ((oldValue: T) => T)) => void] {
  const subscribers = new Set<(value: T) => void>();
  let updating = false;
  let dirty = false;
  let value = initialValue;
  return [
    {
      getValue() {
        return value;
      },
      subscribe(fn): () => void {
        if (subscribers.has(fn)) {
          throw new Error(
            'You cannot subscribe to the same atom multiple times.',
          );
        }
        subscribers.add(fn);
        return () => {
          subscribers.delete(fn);
        };
      },
    },
    function setValue(updatedValue) {
      value =
        typeof updatedValue === 'function'
          ? (updatedValue as any)(value)
          : updatedValue;
      dirty = true;
      while (dirty && !updating) {
        updating = true;
        dirty = false;
        try {
          for (const subscriber of subscribers) {
            subscriber(value);
          }
        } finally {
          updating = false;
        }
      }
    },
  ];
}
