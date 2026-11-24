import {describe, expect, it} from 'vitest';

import {AppMode, ClassType} from '@/oceans/constants';
import {countCorrectPredictions} from '@/oceans/models/pond';
import {
  FishOceanObject,
  SeaCreatureOceanObject,
  TrashOceanObject,
} from '@/oceans/OceanObject';

describe('pond correct classification counts', () => {
  it('counts fish versus trash against object types', () => {
    const objects = [
      new FishOceanObject(1),
      new TrashOceanObject(2),
      new FishOceanObject(3),
    ];
    objects[0].setResult({predictedClassId: ClassType.Like});
    objects[1].setResult({predictedClassId: ClassType.Dislike});
    objects[2].setResult({predictedClassId: ClassType.Dislike});

    expect(countCorrectPredictions(objects, AppMode.FishVTrash)).toBe(2);
  });

  it('counts fish and sea creatures as matching in creatures versus trash', () => {
    const objects = [
      new FishOceanObject(1),
      new SeaCreatureOceanObject(2),
      new TrashOceanObject(3),
    ];
    objects[0].setResult({predictedClassId: ClassType.Like});
    objects[1].setResult({predictedClassId: ClassType.Like});
    objects[2].setResult({predictedClassId: ClassType.Dislike});

    expect(countCorrectPredictions(objects, AppMode.CreaturesVTrash)).toBe(3);
  });

  it('does not invent objective accuracy for word-attribute modes', () => {
    expect(countCorrectPredictions([], AppMode.FishShort)).toBeNull();
    expect(countCorrectPredictions([], AppMode.FishLong)).toBeNull();
  });
});
