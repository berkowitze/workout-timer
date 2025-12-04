import { useState, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core";
import type { DragEndEvent, DragStartEvent, DragOverEvent } from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ExerciseWithId } from "../../types/workout";
import { ExerciseEditor } from "./ExerciseEditor";

interface ExerciseListProps {
  exercises: ExerciseWithId[];
  onChange: (exercises: ExerciseWithId[]) => void;
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
}

interface FlatItem {
  exercise: ExerciseWithId;
  parentId: string | null;
  depth: number;
}

// Colors for different nesting levels
const DEPTH_COLORS = [
  "", // depth 0 - no border
  "border-purple-500/50", // depth 1
  "border-blue-500/50", // depth 2
  "border-emerald-500/50", // depth 3
  "border-amber-500/50", // depth 4+
];

const DEPTH_BG_COLORS = [
  "", // depth 0
  "bg-purple-500/5", // depth 1
  "bg-blue-500/5", // depth 2
  "bg-emerald-500/5", // depth 3
  "bg-amber-500/5", // depth 4+
];

function getDepthColor(depth: number): string {
  return DEPTH_COLORS[Math.min(depth, DEPTH_COLORS.length - 1)];
}

function getDepthBgColor(depth: number): string {
  return DEPTH_BG_COLORS[Math.min(depth, DEPTH_BG_COLORS.length - 1)];
}

// Flatten exercises for rendering, keeping track of parent loops
function flattenForRender(
  exercises: ExerciseWithId[],
  parentId: string | null = null,
  depth = 0,
  expandedIds: Set<string>
): FlatItem[] {
  const result: FlatItem[] = [];
  for (const exercise of exercises) {
    result.push({ exercise, parentId, depth });
    if (exercise.type === "loop" && expandedIds.has(exercise.id)) {
      result.push(...flattenForRender(exercise.exercises, exercise.id, depth + 1, expandedIds));
    }
  }
  return result;
}

// Get all sortable IDs (flattened)
function getAllIds(exercises: ExerciseWithId[], expandedIds: Set<string>): string[] {
  const ids: string[] = [];
  for (const ex of exercises) {
    ids.push(ex.id);
    if (ex.type === "loop" && expandedIds.has(ex.id)) {
      ids.push(...getAllIds(ex.exercises, expandedIds));
    }
  }
  return ids;
}

// Remove exercise from tree
function removeExercise(exercises: ExerciseWithId[], id: string): ExerciseWithId[] {
  return exercises
    .filter((ex) => ex.id !== id)
    .map((ex) => {
      if (ex.type === "loop") {
        return { ...ex, exercises: removeExercise(ex.exercises, id) };
      }
      return ex;
    });
}

// Insert exercise at position
function insertExercise(
  exercises: ExerciseWithId[],
  exercise: ExerciseWithId,
  targetId: string,
  position: "before" | "after" | "inside"
): ExerciseWithId[] {
  const result: ExerciseWithId[] = [];

  for (const ex of exercises) {
    if (ex.id === targetId) {
      if (position === "before") {
        result.push(exercise);
        result.push(ex);
      } else if (position === "after") {
        result.push(ex);
        result.push(exercise);
      } else if (position === "inside" && ex.type === "loop") {
        result.push({ ...ex, exercises: [...ex.exercises, exercise] });
      } else {
        result.push(ex);
      }
    } else if (ex.type === "loop") {
      const updatedLoop = insertExercise(ex.exercises, exercise, targetId, position);
      if (updatedLoop !== ex.exercises) {
        result.push({ ...ex, exercises: updatedLoop });
      } else {
        result.push(ex);
      }
    } else {
      result.push(ex);
    }
  }

  return result;
}

function SortableExercise({
  item,
  onChange,
  onRemove,
  onToggleExpand,
  isExpanded,
  isDropTarget,
}: {
  item: FlatItem;
  onChange: (exercise: ExerciseWithId) => void;
  onRemove: () => void;
  onToggleExpand: () => void;
  isExpanded: boolean;
  isDropTarget?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.exercise.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    marginLeft: `${item.depth * 20}px`,
  };

  const borderColor = getDepthColor(item.depth);
  const bgColor = getDepthBgColor(item.depth);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={`${isDropTarget ? "ring-2 ring-purple-500 rounded-lg" : ""} ${
        item.depth > 0 ? `pl-3 border-l-2 ${borderColor} ${bgColor} rounded-r` : ""
      }`}
    >
      <ExerciseEditor
        exercise={item.exercise}
        onChange={onChange}
        onRemove={onRemove}
        dragHandleProps={listeners}
        isExpanded={isExpanded}
        onToggleExpand={onToggleExpand}
        isNested={item.depth > 0}
        depth={item.depth}
      />
    </div>
  );
}

function DragPreview({ exercise }: { exercise: ExerciseWithId }) {
  const getLabel = () => {
    switch (exercise.type) {
      case "timed":
        return `${exercise.duration}s ${exercise.name}`;
      case "rest":
        return `Rest ${exercise.duration}s`;
      case "numeric":
        return `${exercise.count} ${exercise.name}`;
      case "loop":
        return `${exercise.rounds} rounds`;
    }
  };

  return (
    <div className="bg-slate-light border border-ocean rounded-lg px-3 py-2 shadow-xl">
      <span className="text-white text-sm font-medium">{getLabel()}</span>
    </div>
  );
}

export function ExerciseList({
  exercises,
  onChange,
  expandedIds,
  onToggleExpand,
}: ExerciseListProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const flatItems = flattenForRender(exercises, null, 0, expandedIds);
  const allIds = getAllIds(exercises, expandedIds);

  const activeExercise = activeId
    ? flatItems.find((item) => item.exercise.id === activeId)?.exercise
    : null;

  // Check if overId is an expanded loop (for visual feedback)
  const overItem = overId ? flatItems.find((item) => item.exercise.id === overId) : null;
  const isOverExpandedLoop =
    overItem?.exercise.type === "loop" && expandedIds.has(overItem.exercise.id);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    setOverId(event.over?.id as string | null);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);
      setOverId(null);

      if (!over || active.id === over.id) return;

      const activeItem = flatItems.find((item) => item.exercise.id === active.id);
      const overItem = flatItems.find((item) => item.exercise.id === over.id);

      if (!activeItem || !overItem) return;

      // Don't allow dropping a loop inside itself
      if (activeItem.exercise.type === "loop") {
        let checkId: string | null = overItem.parentId;
        while (checkId) {
          if (checkId === activeItem.exercise.id) return;
          const parent = flatItems.find((item) => item.exercise.id === checkId);
          checkId = parent?.parentId || null;
        }
      }

      // Remove the dragged item
      let newExercises = removeExercise(exercises, active.id as string);

      // Determine where to insert
      if (overItem.exercise.type === "loop" && expandedIds.has(overItem.exercise.id)) {
        // Dropping on an expanded loop - add inside it
        newExercises = insertExercise(
          newExercises,
          activeItem.exercise,
          over.id as string,
          "inside"
        );
      } else {
        // Insert before or after based on position
        const overIndex = flatItems.findIndex((item) => item.exercise.id === over.id);
        const activeIndex = flatItems.findIndex((item) => item.exercise.id === active.id);

        // If dragging to same parent level
        if (activeItem.parentId === overItem.parentId) {
          // Simple reorder within same level
          const position = activeIndex < overIndex ? "after" : "before";
          newExercises = insertExercise(
            newExercises,
            activeItem.exercise,
            over.id as string,
            position
          );
        } else {
          // Moving between levels - insert after the target
          newExercises = insertExercise(
            newExercises,
            activeItem.exercise,
            over.id as string,
            "after"
          );
        }
      }

      onChange(newExercises);
    },
    [exercises, flatItems, expandedIds, onChange]
  );

  const handleExerciseChange = useCallback(
    (id: string, updated: ExerciseWithId) => {
      const updateInTree = (items: ExerciseWithId[]): ExerciseWithId[] => {
        return items.map((ex) => {
          if (ex.id === id) return updated;
          if (ex.type === "loop") {
            return { ...ex, exercises: updateInTree(ex.exercises) };
          }
          return ex;
        });
      };
      onChange(updateInTree(exercises));
    },
    [exercises, onChange]
  );

  const handleRemove = useCallback(
    (id: string) => {
      onChange(removeExercise(exercises, id));
    },
    [exercises, onChange]
  );

  if (exercises.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <svg
          className="w-12 h-12 mx-auto mb-3 opacity-50"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          />
        </svg>
        <p className="text-sm">No exercises yet. Parse a workout or add manually.</p>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={allIds} strategy={verticalListSortingStrategy}>
        <div className="space-y-1.5">
          {flatItems.map((item) => (
            <SortableExercise
              key={item.exercise.id}
              item={item}
              onChange={(updated) => handleExerciseChange(item.exercise.id, updated)}
              onRemove={() => handleRemove(item.exercise.id)}
              onToggleExpand={() => onToggleExpand(item.exercise.id)}
              isExpanded={expandedIds.has(item.exercise.id)}
              isDropTarget={overId === item.exercise.id && isOverExpandedLoop}
            />
          ))}
        </div>
      </SortableContext>

      <DragOverlay>{activeExercise && <DragPreview exercise={activeExercise} />}</DragOverlay>
    </DndContext>
  );
}
