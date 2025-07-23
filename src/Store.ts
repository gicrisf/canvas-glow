import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { devtools } from 'zustand/middleware';

type ActionName =
  'openPage' | // By default, this is the first one
  'check' |
  'click' |  // I implement this one only, but we can extend this later
  'fill' |
  'press' |
  'select' |
  'uncheck' |
  'setInputFiles';

type Point = {
  X: number;
  Y: number;
}

type Action = {
    name: ActionName;
    index: number;
};

type State = {
    message: string;
    isLoadingClick: boolean;
    isLoadingMove: boolean;
    nodes: Point[];
    lastPointRecorded: string;
    allPoints: string[];
    discardedMoves: number;
    actions: Action[];
}

type Actions = {
    addNode: (point: Point) => void;
    setMessage: (msg: string) => void;
    sendMousePosition: (point: Point) => Promise<void>;
    setLastAction: (action: ActionName) => void;
}

const initialState: State = {
    message: "Click on the misterious globe.",
    isLoadingClick: false,
    isLoadingMove: false,
    nodes: [],
    lastPointRecorded: "no one moved yet...",
    allPoints: [],
    discardedMoves: 0,
    actions: [{ name: 'openPage', index: 1 }]
}

export const useStore = create<State & Actions>()(
    devtools(
        immer((set, get) => ({
            ...initialState,
            setMessage: (msg: string) => {
                set((state) => {
                    state.message = msg;
                });
            },
            setLastAction: (name: ActionName) => {
                set((state) => {
                    const count = state.actions.filter(a => a.name === name).length + 1;
                    state.actions.push({ name, index: count });
                });
            },
            addNode: (point: Point) => {
                const log = get().setMessage;

                if (!get().isLoadingClick) {
                    set((state) => {
                        state.isLoadingClick = true;
                        state.nodes.push(point);
                    });

                    console.log("Node pushed. Now loading...");
                    log("Node pushed. Now loading...");

                    new Promise<void>((resolve) => {
                        setTimeout(() => {
                            resolve();
                        }, 10000);
                    }).then(() => {
                        console.log("Job completed after 10 seconds. Click again.");
                        log("Job completed after 10 seconds. Click again.");
                        set((state) => { state.isLoadingClick = false; });
                    });
                } else {
                    console.log("Not now, my friend. I'm busy.");
                    log("Not now, my friend. I'm busy.");
                }
            },
            sendMousePosition: async (point: Point) => {
                if (!get().isLoadingMove) {
                    set((state) => {
                        state.isLoadingMove = true;
                    });
                    // fetch('/api/recordPoint', {
                    //     method: 'POST',
                    //     headers: {
                    //         'Content-Type': 'application/json',
                    //     },
                    //     body: JSON.stringify(point),
                    // })
                    // Emulating this call with a timeout
                    new Promise<void>((resolve) => {
                        // emulate a 10 seconds job
                        setTimeout(() => {
                            resolve();
                        }, 250);
                    }).then(() => {
                        set((state) => {
                            const newPoint = `{ X: ${point.X}; Y: ${point.Y} }`;
                            const actions = state.actions;
                            const lastAction = actions.length > 0 ? actions[actions.length - 1] : null;
                            // Find the last logged action in allPoints
                            let lastLoggedAction = null;
                            for (let i = state.allPoints.length - 1; i >= 0; i--) {
                              if (state.allPoints[i].startsWith('Last action')) {
                                lastLoggedAction = state.allPoints[i];
                                break;
                              }
                            }
                            let shouldLogAction = false;
                            if (lastAction) {
                              const actionString = `Last action ${lastAction.name} ${lastAction.index}`;
                              if (lastLoggedAction === null || lastLoggedAction !== actionString) {
                                shouldLogAction = true;
                              }
                              if (shouldLogAction) {
                                state.allPoints.push(actionString);
                              }
                            }
                            state.lastPointRecorded = newPoint;
                            state.allPoints.push(newPoint);
                            state.isLoadingMove = false;
                        });
                    });
                } else {
                    set((state) => { state.discardedMoves+=1 });
                }
            }
        }))
    )
);
