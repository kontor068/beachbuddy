import React from 'react';

// Helper component to parse and render a line with bold (**text**) formatting.
const renderWithBold = (text: string) => {
  if (!text.includes('**')) {
    return text;
  }
  const parts = text.split('**');
  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? <strong key={index} className="font-bold text-cyan-700">{part}</strong> : part
      )}
    </>
  );
};

interface ListItemNode {
    text: string;
    children: ListItemNode[];
}

// Recursive component to render lists and their nested children
const ListRenderer: React.FC<{ items: ListItemNode[]; isNested?: boolean }> = ({ items, isNested = false }) => {
    if (items.length === 0) return null;

    const ulClass = isNested
        ? "list-none pl-6 pr-2 py-2 mt-2 space-y-2 border-l-4 border-indigo-100 bg-slate-50/80 rounded-r-lg" // Style for nested lists
        : "list-none pl-4 my-3 space-y-2 border-l-2 border-indigo-200"; // Style for top-level lists

    return (
        <ul className={ulClass}>
            {items.map((item, index) => {
                const icon = isNested
                    ? <svg xmlns="http://www.w3.org/2000/svg" className="h-2 w-2 mr-3 mt-2.5 flex-shrink-0 fill-current text-indigo-400" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4" /></svg>
                    : <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-500 mr-3 mt-1 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12h2l3 -9l4 18l3 -9h2"/></svg>;

                return (
                    <li key={index} className="flex items-start text-slate-700">
                        {icon}
                        <span className="flex-1">
                            {renderWithBold(item.text)}
                            {item.children.length > 0 && <ListRenderer items={item.children} isNested={true} />}
                        </span>
                    </li>
                );
            })}
        </ul>
    );
};

// Renders the content (paragraphs and lists) for a single day, supporting nested lists and day titles.
const renderDayContent = (contentLines: string[]) => {
    const elements: React.ReactNode[] = [];
    let listLines: { text: string; indent: number }[] = [];

    const buildListTree = (lines: { text: string; indent: number }[]): ListItemNode[] => {
        if (!lines.length) return [];
        const root: ListItemNode = { text: 'root', children: [] };
        const stack: { node: ListItemNode; indent: number }[] = [{ node: root, indent: -1 }];

        for (const line of lines) {
            const newNode: ListItemNode = { text: line.text, children: [] };
            while (line.indent <= stack[stack.length - 1].indent) {
                stack.pop();
            }
            stack[stack.length - 1].node.children.push(newNode);
            stack.push({ node: newNode, indent: line.indent });
        }
        
        return root.children;
    };

    const flushList = () => {
        if (listLines.length > 0) {
            const listTree = buildListTree(listLines);
            elements.push(<ListRenderer key={`ul-${elements.length}`} items={listTree} />);
            listLines = [];
        }
    };

    contentLines.forEach((line, index) => {
        const trimmedLine = line.trim();
        const isListItem = trimmedLine.startsWith('- ');
        const isTitle = trimmedLine.startsWith('### ');

        if (isTitle) {
            flushList();
            // Add a separator for subsequent day titles to visually divide the content.
            if (elements.length > 0) {
                 elements.push(<hr key={`hr-${index}`} className="my-6 border-slate-200/80" />);
            }
            elements.push(
                <h4 key={`title-${index}`} className="text-lg font-extrabold text-indigo-800 mb-2 flex items-center gap-3">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    {renderWithBold(trimmedLine.length >= 4 ? trimmedLine.substring(4) : trimmedLine)}
                </h4>
            );
        } else if (isListItem) {
            const indent = line.search(/\S|$/);
            listLines.push({ text: trimmedLine.length >= 2 ? trimmedLine.substring(2) : trimmedLine, indent });
        } else {
            flushList();
            if (trimmedLine) {
                elements.push(<p key={index} className="my-2 text-slate-600 leading-relaxed">{renderWithBold(trimmedLine)}</p>);
            }
        }
    });

    flushList();
    return <>{elements}</>;
};


interface DayPlan {
  title: string;
  content: string[]; // array of lines
}

// A structured and secure component to display the itinerary from Markdown-like text.
const ItineraryDisplay: React.FC<{ content: string }> = ({ content }) => {
  const [openIndices, setOpenIndices] = React.useState<number[]>([0]); // Open first day by default

  const toggleDay = (index: number) => {
    setOpenIndices(prev => 
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const plans: DayPlan[] = React.useMemo(() => {
    const parsedPlans: DayPlan[] = [];
    let currentPlan: DayPlan | null = null;
    const lines = content.trim().split('\n');

    for (const line of lines) {
        const trimmedTitleLine = line.trim();
        if (trimmedTitleLine.startsWith('### ')) {
          if (currentPlan) {
            parsedPlans.push(currentPlan);
          }
          currentPlan = { title: trimmedTitleLine.length >= 4 ? trimmedTitleLine.substring(4) : trimmedTitleLine, content: [] };
        } else if (currentPlan) {
        currentPlan.content.push(line);
      }
    }
    if (currentPlan) {
      parsedPlans.push(currentPlan);
    }
    return parsedPlans;
  }, [content]);
  
  // If content is not structured with days, render it plainly using the enhanced renderDayContent.
  if (plans.length === 0) {
     return <div className="p-5 bg-gradient-to-br from-slate-50 to-indigo-50/20 rounded-lg border border-slate-200 shadow-inner">{renderDayContent(content.trim().split('\n'))}</div>;
  }

  return (
    <div className="space-y-2">
      {plans.map((plan, index) => {
        const isOpen = openIndices.includes(index);
        return (
          <div key={index} className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
            <h3 className="m-0">
                <button
                onClick={() => toggleDay(index)}
                className="w-full flex items-center justify-between text-left p-3 bg-slate-100 hover:bg-slate-200/70 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                aria-expanded={isOpen}
                aria-controls={`itinerary-day-${index}`}
                >
                <span className="flex items-center gap-3 text-lg font-extrabold text-indigo-800">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 flex-shrink-0 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    <span className="flex-1">{renderWithBold(plan.title)}</span>
                </span>
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 text-indigo-500 transform transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                </button>
            </h3>
            <div
              id={`itinerary-day-${index}`}
              className={`transition-all duration-500 ease-in-out grid ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
            >
              <div className="overflow-hidden">
                <div className="p-4 pt-2 border-t border-slate-200">
                  {renderDayContent(plan.content)}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ItineraryDisplay;
