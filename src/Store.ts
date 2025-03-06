import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { devtools } from 'zustand/middleware';

type Point = {
  X: number;
  Y: number;
}

type State = {
    message: string;
    isLoadingClick: boolean;
    isLoadingMove: boolean;
    nodes: Node[];
    lastPointRecorded: string;
    discardedMoves: number;
}

type Actions = {
    addNode: (point: Point) => void;
    setMessage: (msg: string) => void;
    sendMousePosition: (point: Point) => Promise<void>;
}

const initialState: State = {
    message: "Click on the misterious globe.",
    isLoadingClick: false,
    isLoadingMove: false,
    nodes: [],
    lastPointRecorded: "no one moved yet...",
    discardedMoves: 0
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
            addNode: (point: Point) => {
                const log = get().setMessage;

                if (!get().isLoadingClick) {
                    set((state) => {
                        state.isLoadingClick = true;
                        state.nodes.push(point);
                    });

                    console.log("Node pushed. Now loading...");
                    log("Node pushed. Now loading...");

                    new Promise((resolve) => {
                        // emulate a 10 seconds job
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
                    new Promise((resolve) => {
                        // emulate a 10 seconds job
                        setTimeout(() => {
                            resolve();
                        }, 250);
                    }).then(() => {
                        set((state) => {
                            state.lastPointRecorded = `{ X: ${point.X}; Y: ${point.Y} }`;
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
