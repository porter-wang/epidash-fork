"use client";

import React, { useMemo, useState } from "react";

import { modelColorMap, modelNames } from "@/interfaces/epistorm-constants";
import { SeasonOption } from "@/interfaces/forecast-interfaces";

import SettingsStateMap from "@/shared-components/SettingsStateMap";

import { useAppDispatch, useAppSelector } from "@/store/hooks";

import {
  updateEvaluationSingleModelViewSelectedState,
  updateEvaluationsSingleModelViewModel,
  updateEvaluationSingleModelViewHorizon,
  updateEvaluationSingleModelViewDateStart,
  updateEvaluationSingleModelViewDateEnd,
  updateEvaluationsSingleModelViewDateRange,
  updateEvaluationScores,
  // updateEvaluationSingleModelViewSeasonOptions,
} from "@/store/evaluations-single-model-settings-slice";

import { Radio, Typography } from "@/styles/material-tailwind-wrapper";

import Image from "next/image";

const SingleModelSettingsPanel: React.FC = () => {
  /* Redux-Managed State Variables */
  const dispatch = useAppDispatch();

  const groundTruthData = useAppSelector((state) => state.groundTruth.data);
  const locationData = useAppSelector((state) => state.location.data);

  const [scoreOptions] = useState(["WIS/Baseline", "MAPE"]);

  // Evaluation-specific state
  const {
    evaluationsSingleModelViewSelectedStateCode,
    evaluationsSingleModelViewModel,
    evaluationSingleModelViewHorizon,
    evaluationSingleModelViewScoresOption,
    evaluationsSingleModelViewDateRange,
    evaluationSingleModelViewSeasonOptions,
  } = useAppSelector((state) => state.evaluationsSingleModelSettings);

  // State selection handlers (reused from forecast)
  const onStateSelectionChange = (stateNum: string) => {
    const selectedState = locationData.find((state) => state.stateNum === stateNum);
    if (selectedState) {
      dispatch(
        updateEvaluationSingleModelViewSelectedState({
          stateName: selectedState.stateName,
          stateNum: selectedState.stateNum,
        })
      );
    }
  };

  // Model selection handler (single model only)
  const onModelSelectionChange = (modelName: string) => {
    dispatch(updateEvaluationsSingleModelViewModel(modelName));
  };

  // Horizon handler
  const onHorizonChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(updateEvaluationSingleModelViewHorizon(Number(event.target.value)));
  };

  // Season selection handler (shared with forecast)
  const onSeasonSelectionChange = (timeValue: string) => {
    const selectedOption = evaluationSingleModelViewSeasonOptions.find((option) => option.timeValue === timeValue);
    if (selectedOption) {
      dispatch(updateEvaluationsSingleModelViewDateRange(timeValue));
      dispatch(updateEvaluationSingleModelViewDateStart(selectedOption.startDate));
      dispatch(updateEvaluationSingleModelViewDateEnd(selectedOption.endDate));
    }
  };

  // Add handler
  const onScoreSelectionChange = (value: string) => {
    dispatch(updateEvaluationScores(value));
  };

  return (
    <div className='bg-mobs-lab-color-filterspane text-white fill-white flex flex-col h-full rounded-md overflow-hidden util-responsive-text-settings'>
      <div className='flex-grow nowrap overflow-y-auto p-4 util-no-sb-length'>
        <div className='mb-4 w-full overflow-ellipsis'>
          <h2>Select Location</h2>
          <div className='w-full'>
            <SettingsStateMap pageSelected='evaluations' />
          </div>
          <select
            value={evaluationsSingleModelViewSelectedStateCode}
            onChange={(e) => onStateSelectionChange(e.target.value)}
            className='text-white border-[#5d636a] border-2 font-sans bg-mobs-lab-color-filterspane rounded-md px-2 py-4 w-full'>
            {locationData.map((state) => (
              <option key={state.state} value={state.stateNum}>
                {state.stateName}
              </option>
            ))}
          </select>
        </div>

        <div className='mb-2 w-full overflow-ellipsis'>
          <Typography variant='h6' className='text-white mb-2'>
            Models
          </Typography>
          <div className='space-y-2 h-full overflow-y-auto pr-1'>
            {modelNames.map((model) => (
              <label key={model} className='inline-flex items-center text-white hover:bg-gray-700 rounded cursor-pointer w-full'>
                <span
                  className='w-[1em] h-[1em] border-2 rounded-sm mr-2'
                  style={{
                    backgroundColor: evaluationsSingleModelViewModel === model ? modelColorMap[model] : "transparent",
                    borderColor: modelColorMap[model],
                  }}
                />
                <input
                  type='radio'
                  className='sr-only'
                  checked={evaluationsSingleModelViewModel === model}
                  onChange={() => onModelSelectionChange(model)}
                />
                <span className='ml-2 xs:text-sm'>{model}</span>
              </label>
            ))}
          </div>
        </div>

        <div className='mb-2 w-full'>
          <Typography variant='h6' className='text-white'>
            Horizon
          </Typography>
          {[0, 1, 2, 3].map((value) => (
            <Radio
              key={value}
              name='horizonRadioBtn'
              value={value.toString()}
              label={value.toString()}
              onChange={onHorizonChange}
              className='text-white'
              labelProps={{ className: "text-white" }}
              checked={evaluationSingleModelViewHorizon === value}
            />
          ))}
        </div>

        <div className='w-full mb-2'>
          <Typography variant='h6' className='text-white'>
            Season
          </Typography>
          <select
            value={evaluationsSingleModelViewDateRange}
            onChange={(e) => onSeasonSelectionChange(e.target.value)}
            className='text-white border-[#5d636a] border-2 flex-wrap bg-mobs-lab-color-filterspane rounded-md w-full py-2 px-2 overflow-ellipsis'>
            {evaluationSingleModelViewSeasonOptions.map((option: SeasonOption) => (
              <option key={option.index} value={option.timeValue}>
                {option.displayString}
              </option>
            ))}
          </select>
        </div>
        <div className='w-full justify-stretch items-stretch mb-2'>
          <Typography variant='h6' className='text-white'>
            Score
          </Typography>
          <select
            value={evaluationSingleModelViewScoresOption}
            onChange={(e) => onScoreSelectionChange(e.target.value)}
            className='text-white border-[#5d636a] border-2 bg-mobs-lab-color-filterspane rounded-md w-full p-2'>
            {scoreOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className='mt-auto p-2 border-t border-gray-700'>
        <Image src='/epistorm-logo.png' width={300} height={120} alt='Epistorm Logo' className='mx-auto' />
      </div>
    </div>
  );
};

export default SingleModelSettingsPanel;
