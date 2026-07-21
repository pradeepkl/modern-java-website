export interface ChapterSection {
  id: string;
  label: string;
  title: string;
}

export interface Chapter {
  id: string;
  number: number;
  title: string;
  fullTitle: string;
  summary: string;
  sections: ChapterSection[];
  concepts: string;
  includes: string;
  takeaway: string;
}

export const chapterHighlights = [
  { id: 'chapters', label: '12 in-depth chapters', icon: 'laptop' as const },
  { id: 'examples', label: '100+ examples and diagrams', icon: 'code' as const },
  { id: 'practical', label: 'Practical, modern, purposeful', icon: 'check' as const },
] as const;

export const appendices = [
  { id: 'a', label: 'A Functional Interfaces' },
  { id: 'b', label: 'B Modern Date and Time' },
] as const;

function sections(
  chapterNumber: number,
  titles: string[],
): ChapterSection[] {
  return titles.map((title, index) => {
    const n = index + 1;
    const label = `${chapterNumber}.${n}`;
    return { id: label, label, title };
  });
}

export const chapters: Chapter[] = [
  {
    id: 'ch-01',
    number: 1,
    title: 'The Mindset Shift',
    fullTitle: 'The Mindset Shift',
    summary:
      'Learn the shift from writing code that merely works to writing code that expresses intent. Discover how modern language features enable clearer, safer design.',
    sections: sections(1, [
      'Why Modern Java',
      'The Compiler Already Knew',
      'What Changed and What Did Not',
    ]),
    concepts: 'Intent, Design, Abstraction, Compiler',
    includes: '3 sections, diagrams and listings',
    takeaway: 'Think in models, not mechanics.',
  },
  {
    id: 'ch-02',
    number: 2,
    title: 'Functional Interfaces',
    fullTitle: 'Functional Interfaces',
    summary:
      'Treat behavior as data. Move from anonymous classes to lambdas, learn the functional contracts, and compose pipelines with a clear vocabulary.',
    sections: sections(2, [
      'Behavior as a Value',
      'From Anonymous Classes to Lambdas',
      'The Functional Contracts',
      'Composing the Pipeline',
      'The Vocabulary in Action',
      'What Did Not Change',
    ]),
    concepts: 'Lambdas, SAM, Composition, Contracts',
    includes: '6 sections, diagrams and listings',
    takeaway: 'Pass intent, not just instructions.',
  },
  {
    id: 'ch-03',
    number: 3,
    title: 'Modern Type Design',
    fullTitle: 'Modern Type Design',
    summary:
      'Model domains with interfaces, records, sealed types, and abstract classes so capabilities, values, and closed domains stay explicit.',
    sections: sections(3, [
      'Why Inheritance Lost Its Default',
      'Interfaces as Capabilities',
      'Records as Values',
      'Sealed Types for Closed Domains',
      'Abstract Classes for Algorithms',
      'Default Methods for Evolution',
      'Designing a Refund Processing API',
    ]),
    concepts: 'Records, Sealed Types, Interfaces, Domains',
    includes: '7 sections, diagrams and listings',
    takeaway: 'Make invalid states unrepresentable.',
  },
  {
    id: 'ch-04',
    number: 4,
    title: 'Pattern Matching',
    fullTitle: 'Pattern Matching',
    summary:
      'Replace cast-heavy branching with patterns, sealed switches, and record patterns that mirror the shape of your data.',
    sections: sections(4, [
      'From Cast to Pattern',
      'The Sealed Switch',
      'Record Patterns',
      'Guarded Patterns and Null',
      'Combining the Capabilities',
      'A Vocabulary of Patterns',
      'Choosing the Right Construct',
    ]),
    concepts: 'Patterns, Switch, Records, Exhaustiveness',
    includes: '7 sections, diagrams and listings',
    takeaway: 'Let structure drive control flow.',
  },
  {
    id: 'ch-05',
    number: 5,
    title: 'Java Modules',
    fullTitle: 'Java Modules',
    summary:
      'Draw explicit boundaries with exports, requires, opens, and services—and know when modules are the wrong tool.',
    sections: sections(5, [
      'Why Packages Fail as Boundaries',
      'exports — Declaring Public API',
      'exports … to — Qualified Exports',
      'requires — Declaring Dependencies',
      'opens — Reflective Access',
      'Contract-Based Services',
      'A Modular Payment Platform',
      'When Modules Are the Wrong Tool',
      'Common Pitfalls',
    ]),
    concepts: 'JPMS, Boundaries, Encapsulation, Services',
    includes: '9 sections, diagrams and listings',
    takeaway: 'Boundaries are a design choice.',
  },
  {
    id: 'ch-06',
    number: 6,
    title: 'Exception Handling',
    fullTitle: 'Exception Handling',
    summary:
      'Treat failure as part of the design—checked and unchecked exceptions, Optional, sealed results, and layer-aware propagation.',
    sections: sections(6, [
      'The Unverified Default',
      'Checked vs Unchecked Exceptions',
      'Optional Represents Absence',
      'try-with-resources Cleanup',
      'Exhaustive Failure Handling',
      'Chaining and Cause Preservation',
      'Exception Propagation by Layer',
      'When Null Is Deliberate',
      'Exceptions vs Sealed Results',
      'Designing Refund Processing',
      'Choosing the Right Construct',
    ]),
    concepts: 'Exceptions, Optional, Sealed Results',
    includes: '11 sections, diagrams and listings',
    takeaway: 'Design the unhappy path too.',
  },
  {
    id: 'ch-07',
    number: 7,
    title: 'Primitives and Wrappers',
    fullTitle: 'Primitives and Wrappers',
    summary:
      'Choose representations deliberately across primitives, wrappers, primitive streams, and Optional—without leaking cost or null surprises.',
    sections: sections(7, [
      'Two Type Worlds, One Language',
      'Crossing Once via Primitive Streams',
      'Primitive Functional Interfaces',
      'Wrappers as Modelling Tools',
      'Unboxing and NullPointerException',
      'Optional for Primitives',
      'Choosing the Right Representation',
    ]),
    concepts: 'Primitives, Wrappers, Streams, Optional',
    includes: '7 sections, diagrams and listings',
    takeaway: 'Representation is part of the model.',
  },
  {
    id: 'ch-08',
    number: 8,
    title: 'Concurrency Foundations',
    fullTitle: 'Concurrency Foundations',
    summary:
      'Build a solid mental model of shared state, synchronization, executors, atomics, and concurrent collections before reaching for higher-level tools.',
    sections: sections(8, [
      'Why Applications Are Concurrent',
      'Shared State and Race Conditions',
      'Immutability and Stateless Design',
      'Synchronization and Visibility',
      'Executors and Thread Pools',
      'Atomics and Lock-Free Coordination',
      'ThreadLocal and Isolated State',
      'Concurrent Collections',
      'When to Avoid Manual Concurrency',
    ]),
    concepts: 'Threads, Shared State, Synchronization',
    includes: '9 sections, diagrams and listings',
    takeaway: 'Understand the model before the API.',
  },
  {
    id: 'ch-09',
    number: 9,
    title: 'Modern Concurrency',
    fullTitle: 'Modern Concurrency',
    summary:
      'Move from choreography to orchestration with structured concurrency, virtual threads, and clear choices about when not to use them.',
    sections: sections(9, [
      'From Choreography to Orchestration',
      'Composing the Workflow',
      'Timeouts and Failures',
      'Limits of Unstructured Composition',
      'Structured Concurrency',
      'Virtual Threads and Cheap Blocking',
      'Choosing the Right Abstraction',
      'When Not to Use These Abstractions',
      'End-to-End Settlement Pipeline',
    ]),
    concepts: 'Structured Concurrency, Virtual Threads',
    includes: '9 sections, diagrams and listings',
    takeaway: 'Structure concurrent work like sequential work.',
  },
  {
    id: 'ch-10',
    number: 10,
    title: 'Collections',
    fullTitle: 'Collections',
    summary:
      'Treat collections as ownership boundaries—encapsulate mutation, prefer immutability, and design safe APIs that communicate intent.',
    sections: sections(10, [
      'Collections as Ownership Boundaries',
      'Shared Mutable Collection Risks',
      'Encapsulating Mutation',
      'Defensive Copying',
      'Immutable Collection Factories',
      'Stream Pipeline Results',
      'Views vs Immutable Collections',
      'Empty Collections, Not Null',
      'Concurrency and Immutability',
      'Safe Collection APIs',
      'Ownership Decision Tree',
      'When Not to Prefer Immutability',
      'The Ownership Spine',
    ]),
    concepts: 'Ownership, Immutability, Safe APIs',
    includes: '13 sections, diagrams and listings',
    takeaway: 'The structure should say what you mean.',
  },
  {
    id: 'ch-11',
    number: 11,
    title: 'Declarative Data Transformations',
    fullTitle: 'Declarative Data Transformations',
    summary:
      'Move from external to internal iteration—partition, group, aggregate, and compose pipelines with clear execution boundaries.',
    sections: sections(11, [
      'External to Internal Iteration',
      'Primitive Boundary Discipline',
      'Classification by Partitioning',
      'Classification by Grouping',
      'Grouping with Aggregation',
      'Multi-Level Classification',
      'Pipeline Composition',
      'Execution Strategy Boundaries',
    ]),
    concepts: 'Pipelines, Grouping, Aggregation',
    includes: '8 sections, diagrams and listings',
    takeaway: 'Describe the result, not the loop.',
  },
  {
    id: 'ch-12',
    number: 12,
    title: 'Streams',
    fullTitle: 'Streams',
    summary:
      'Use laziness, sources, sinks, and composition to process data with clarity—while keeping primitive, wrapper, and concurrency discipline.',
    sections: sections(12, [
      'Laziness as Ownership',
      'Sources Beyond Collections',
      'Sinks Beyond Collections',
      'Behaviour Across a Pipeline',
      'Pipeline Discipline',
      'Primitive and Wrapper Discipline',
      'Composing Streams',
      'Concurrency Patterns',
      'Full Pipeline Composition',
    ]),
    concepts: 'Streams, Laziness, Composition',
    includes: '9 sections, diagrams and listings',
    takeaway: 'Compose operations; preserve clarity.',
  },
];
