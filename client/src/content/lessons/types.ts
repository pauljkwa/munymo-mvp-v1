export interface LessonQuiz {
  questionType: "multiple_choice" | "true_false";
  questionText: string;
  options: string[] | null; // 4 strings for multiple_choice, null for true_false
  correctAnswer: string; // exact option text, or "True"/"False"
  explanation: string; // one sentence, shown after answering
}

export interface Lesson {
  id: string; // stable, e.g. "l100-1" — NEVER change once shipped (progress rows reference it)
  level: 100 | 200 | 300 | 400 | 500;
  order: number; // position within level, 1-based
  title: string;
  jargonTerm: string | null; // the one new term this lesson introduces, or null
  body: string; // the lesson prose (plain text, \n\n between paragraphs)
  matchupHook: string; // one sentence: where to see this in the daily game
  quiz: LessonQuiz;
  isCapstone: boolean; // capstones require the rest of the level to be complete
  tags: string[]; // for lesson-of-the-day matching, from the vocabulary in Section 7
}

export interface Level {
  level: 100 | 200 | 300 | 400 | 500;
  title: string; // e.g. "How the Market Works"
  goal: string; // one sentence, shown on the level card
  lessons: Lesson[];
}
