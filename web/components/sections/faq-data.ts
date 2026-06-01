export type FaqEntry = {
  question: string;
  answer: string;
};

export const faqEntries: FaqEntry[] = [
  {
    question: "What sports does Grit support?",
    answer:
      "Running, cycling, swimming, strength training, mobility, and general fitness have direct support in the app, but any sport can be recorded. Grit can also recommend, guide or simply take into account any other sports that you do, like football, padel, hiking etc.",
  },
  {
    question: "Can I change my plan whenever I want?",
    answer:
      "Yes — your program is yours to steer. Tell Grit you're sick, going on vacation, need fewer days this week, or want to push harder, and it reworks the plan for you. Every change is a proposal you approve, you can ask for guidance any time, and you can track all your activities and progress in one place.",
  },
  {
    question: "Do I need a smartwatch?",
    answer:
      "No. You can record workouts directly in the app with your phone's GPS and any Bluetooth heart-rate strap, or import from your watch or other devices. Apple and Google Health are supported as well.",
  },
  {
    question: "Does it work offline?",
    answer:
      "Yes. The app caches your program and recent workouts so it stays usable without signal. Your data syncs automatically when you reconnect.",
  },
  {
    question: "How is my data handled?",
    answer:
      "Your training data is yours. We store it securely on EU infrastructure, never sell it, and you can export or delete your account at any time. See the Privacy Policy for full details.",
  },
  {
    question: "Can I cancel Premium?",
    answer:
      "Anytime, directly from your subscription settings. You keep Premium features until the end of the billing period.",
  },
  {
    question: "What happens when I delete my account?",
    answer:
      "All personal data, workouts, conversations, and program history are permanently deleted immediately. Be mindful when your delete your account, as there is no undo.",
  },
];
