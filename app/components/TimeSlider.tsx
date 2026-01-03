import { useState, useEffect, useCallback, useRef } from "react";

interface TimeSliderProps {
  timeSteps: Array<{
    forecastHour: number;
    validTime: string;
  }>;
  currentIndex: number;
  onTimeChange: (index: number) => void;
}

export function TimeSlider({
  timeSteps,
  currentIndex,
  onTimeChange,
}: TimeSliderProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Use refs to avoid recreating the interval on every index change
  const currentIndexRef = useRef(currentIndex);
  const timeStepsLengthRef = useRef(timeSteps.length);
  const onTimeChangeRef = useRef(onTimeChange);

  // Keep refs in sync
  currentIndexRef.current = currentIndex;
  timeStepsLengthRef.current = timeSteps.length;
  onTimeChangeRef.current = onTimeChange;

  // Format time for display
  const formatTime = (validTime: string) => {
    const date = new Date(validTime);
    return date.toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    });
  };

  // Format forecast hour
  const formatForecastHour = (hour: number) => {
    if (hour === 0) return "Now";
    if (hour < 24) return `+${hour}h`;
    const days = Math.floor(hour / 24);
    const hours = hour % 24;
    if (hours === 0) return `+${days}d`;
    return `+${days}d ${hours}h`;
  };

  // Handle play/pause
  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  // Auto-advance when playing
  // Only recreate interval when isPlaying changes, not on every index change
  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        const nextIndex =
          (currentIndexRef.current + 1) % timeStepsLengthRef.current;
        onTimeChangeRef.current(nextIndex);
      }, 1500); // 1.5 seconds per frame
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        onTimeChange(Math.max(0, currentIndex - 1));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        onTimeChange(Math.min(timeSteps.length - 1, currentIndex + 1));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, timeSteps.length, onTimeChange, togglePlay]);

  if (timeSteps.length <= 1) {
    // Single time step - don't show slider
    return null;
  }

  const currentStep = timeSteps[currentIndex];

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-1000 bg-slate-900/90 backdrop-blur-sm rounded-xl p-4 shadow-lg min-w-[400px]">
      {/* Current time display */}
      <div className="text-center mb-3">
        <div className="text-white font-medium">
          {formatTime(currentStep.validTime)}
        </div>
        <div className="text-slate-400 text-sm">
          Forecast: {formatForecastHour(currentStep.forecastHour)}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        {/* Play/Pause button */}
        <button
          onClick={togglePlay}
          aria-label={
            isPlaying ? "Pause animation (Space)" : "Play animation (Space)"
          }
          className="w-10 h-10 flex items-center justify-center rounded-full bg-blue-600 hover:bg-blue-500 text-white transition-colors"
          title={isPlaying ? "Pause (Space)" : "Play (Space)"}
        >
          {isPlaying ? (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          ) : (
            <svg
              className="w-5 h-5 ml-0.5"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Slider */}
        <div className="flex-1">
          <label htmlFor="time-slider" className="sr-only">
            Select forecast time step
          </label>
          <input
            id="time-slider"
            type="range"
            min={0}
            max={timeSteps.length - 1}
            value={currentIndex}
            onChange={(e) => onTimeChange(parseInt(e.target.value, 10))}
            aria-label={`Time step ${currentIndex + 1} of ${timeSteps.length}`}
            aria-valuemin={0}
            aria-valuemax={timeSteps.length - 1}
            aria-valuenow={currentIndex}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer
                       [&::-webkit-slider-thumb]:appearance-none
                       [&::-webkit-slider-thumb]:w-4
                       [&::-webkit-slider-thumb]:h-4
                       [&::-webkit-slider-thumb]:rounded-full
                       [&::-webkit-slider-thumb]:bg-blue-500
                       [&::-webkit-slider-thumb]:hover:bg-blue-400
                       [&::-webkit-slider-thumb]:transition-colors"
          />

          {/* Time step indicators */}
          <div
            className="flex justify-between mt-1 px-1"
            role="group"
            aria-label="Time step shortcuts"
          >
            {timeSteps.map((step, idx) => (
              <button
                key={idx}
                onClick={() => onTimeChange(idx)}
                aria-label={`Go to ${formatForecastHour(step.forecastHour)} - ${formatTime(step.validTime)}`}
                aria-pressed={idx === currentIndex}
                className={`text-xs transition-colors ${
                  idx === currentIndex
                    ? "text-blue-400 font-medium"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {formatForecastHour(step.forecastHour)}
              </button>
            ))}
          </div>
        </div>

        {/* Step buttons */}
        <div className="flex gap-1">
          <button
            onClick={() => onTimeChange(Math.max(0, currentIndex - 1))}
            disabled={currentIndex === 0}
            aria-label="Previous time step (Left Arrow)"
            className="w-8 h-8 flex items-center justify-center rounded bg-slate-700 hover:bg-slate-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Previous (←)"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <button
            onClick={() =>
              onTimeChange(Math.min(timeSteps.length - 1, currentIndex + 1))
            }
            disabled={currentIndex === timeSteps.length - 1}
            aria-label="Next time step (Right Arrow)"
            className="w-8 h-8 flex items-center justify-center rounded bg-slate-700 hover:bg-slate-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Next (→)"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
