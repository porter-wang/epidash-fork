import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import {NowcastTrendByModel, NowcastTrendsCollection} from '@/interfaces/forecast-interfaces';


const initialState: NowcastTrendsCollection = {
    allData: [],
};

const nowcastTrendsSlice = createSlice({
    name: 'nowcastTrends',
    initialState,
    reducers: {
        setNowcastTrendsData: (state, action: PayloadAction<NowcastTrendByModel[]>) => {
            state.allData = action.payload;
        },
    },
});

export const { setNowcastTrendsData } = nowcastTrendsSlice.actions;

export default nowcastTrendsSlice.reducer;