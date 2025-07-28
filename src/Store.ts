import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { devtools } from 'zustand/middleware';

type PwActionName =
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

type PwAction = {
    name: PwActionName;
    index: number;
    points: Point[];
};

type State = {
    message: string;
    isLoadingClick: boolean;
    isLoadingMove: boolean;
    nodes: Point[];
    discardedMoves: number;
    moves: Point[];
    actions: PwAction[];
    lastAction: PwAction;
}

type Actions = {
    addNode: (point: Point) => void;
    setMessage: (msg: string) => void;
    sendMousePosition: (point: Point) => Promise<void>;
    updateLastAction: (action: PwActionName) => void;
}

const initialState: State = {
    message: "Click on the misterious globe.",
    isLoadingClick: false,
    isLoadingMove: false,
    nodes: [],
    discardedMoves: 0,
    moves: [],
    actions: [],
    lastAction: { name: 'openPage', index: 0, points: [] },
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
            updateLastAction: (name: PwActionName) => {
                set((state) => {
                    // Store the previous action in the actions array
                    state.actions.push(state.lastAction);
                    // and increment the index for the next one
                    const count = state.actions.filter(a => a.name === name).length;
                    // Update the last action with the new name and index
                    state.lastAction = { name, index: count, points: [] };
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
                            state.moves.push({ X: point.X, Y: point.Y });
                            state.lastAction.points.push({ X: point.X, Y: point.Y });
                            console.log(`Point received: (${point.X}, ${point.Y})`);
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
