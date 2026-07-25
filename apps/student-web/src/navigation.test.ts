import { expect, test } from 'vitest';

import { bottomBarSeating } from './navigation';

const seat = (priorities: ReadonlyArray<number>): ReadonlyArray<number> =>
  bottomBarSeating(priorities.map((priority) => ({ priority }))).map(({ priority }) => priority);

test('the leading destination takes the middle seat when there is one', () => {
  // Five seats: rank 1 sits centre, the rest fill outwards in rank order.
  expect(seat([2, 3, 1, 4, 5])).toEqual([2, 3, 1, 4, 5]);
  expect(seat([5, 4, 3, 2, 1])).toEqual([2, 3, 1, 4, 5]);
  expect(seat([3, 1, 2])).toEqual([2, 1, 3]);
});

test('an even bar has no middle, so rank order is the seating', () => {
  expect(seat([4, 2, 1, 3])).toEqual([1, 2, 3, 4]);
  expect(seat([2, 1])).toEqual([1, 2]);
});

test('seating is a rearrangement, never a filter', () => {
  const priorities = [7, 2, 9, 1, 4];
  expect([...seat(priorities)].sort((a, b) => a - b)).toEqual([1, 2, 4, 7, 9]);
  expect(seat([])).toEqual([]);
  expect(seat([1])).toEqual([1]);
});
