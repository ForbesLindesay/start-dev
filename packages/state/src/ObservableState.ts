export default interface ObservableState<T> {
  getValue(): T;
  subscribe(fn: (value: T) => void): () => void;
}
