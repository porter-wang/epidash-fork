'use client'

import React, {useEffect, useRef, useState} from "react";
import * as d3 from "d3";
import {subWeeks} from "date-fns";

import {modelColorMap} from "../../../Interfaces/modelColors";
import {
    DataPoint,
    isUTCDateEqual,
    ModelPrediction,
    PredictionDataPoint
} from "../../../Interfaces/forecast-interfaces";
import {useAppDispatch, useAppSelector} from "../../../store/hooks";


const SingleModelHorizonPlot: React.FC = () => {

    const boxPlotRef = useRef<SVGSVGElement>(null);

    // Get the ground and prediction data from store
    const groundTruthData = useAppSelector((state) => state.groundTruth.data);
    // console.debug("DEBUG: SingleModelHorizonPlot.tsx: groundTruthData", groundTruthData);

    const predictionsData = useAppSelector((state) => state.predictions.data);

    const {
        evaluationsSingleModelViewSelectedStateCode,
        evaluationsSingleModelViewDateStart,
        evaluationSingleModelViewDateEnd,
        evaluationSingleModelViewModel,
        evaluationSingleModelViewHorizon,
        // evaluationSingleModelViewSeasonOptions,
    } = useAppSelector((state) => state.evaluationsSingleModelSettings);


    // Function to filter ground truth data by selected state and dates
    function filterGroundTruthData(data: DataPoint[], state: string, dateRange: [Date, Date]): DataPoint[] {
        let filteredData = data.filter((d) => d.stateNum === state);

        // console.debug("DEBUG: SingleModelHorizonPlot.tsx: filterGroundTruthData: filteredData (using state)", filteredData);

        // Filter data by date range
        filteredData = filteredData.filter(
            (d) => d.date >= dateRange[0] && d.date <= dateRange[1]
        );

        return filteredData;
    }

    // Process data function
    function processVisualizationData(
        predictions: ModelPrediction[],
        modelName: string,
        state: string,
        horizon: number,
        dateRange: [Date, Date]
    ) {
        const modelPrediction = predictions.find(model => model.modelName === modelName);
        if (!modelPrediction) return [];

        // Filter predictions for selected state and date range
        const stateData = modelPrediction.predictionData.filter(d =>
            d.stateNum === state &&
            d.referenceDate >= dateRange[0] &&
            d.referenceDate <= dateRange[1]
        );

        // Group by reference date
        const groupedData = d3.group(stateData, d => d.referenceDate.toISOString());

        // Process each group
        return Array.from(groupedData, ([date, group]) => {
            const targetWeekData = group.filter(d => {
                // Calculate expected target date for this horizon
                const expectedTargetDate = new Date(d.referenceDate);
                expectedTargetDate.setDate(expectedTargetDate.getDate() + (horizon * 7));

                // Set both dates to UTC midnight for comparison
                const targetEndUTC = new Date(d.targetEndDate);
                targetEndUTC.setUTCHours(0, 0, 0, 0);
                expectedTargetDate.setUTCHours(0, 0, 0, 0);

                // Calculate weeks between dates
                const weeksDiff = Math.round(
                    (targetEndUTC.getTime() - d.referenceDate.getTime()) /
                    (7 * 24 * 60 * 60 * 1000)
                );

                // Buffer for same-day comparison
                const bufferMs = 2 * 60 * 60 * 1000;
                const timeDiff = Math.abs(targetEndUTC.getTime() - expectedTargetDate.getTime());

                // Only return true if this is exactly the horizon we want
                return timeDiff <= bufferMs && weeksDiff === horizon;
            });

            if (targetWeekData.length === 0) return null;

            const prediction = targetWeekData[0];
            return {
                date: new Date(date),
                median: prediction.confidence500,
                quantile05: prediction.confidence050,
                quantile25: prediction.confidence250,
                quantile75: prediction.confidence750,
                quantile95: prediction.confidence950
            };
        }).filter(d => d !== null);
    }


    function createScalesAndAxes(
        groundTruthData: DataPoint[],
        visualData: any[],
        chartWidth: number,
        chartHeight: number
    ) {
        // Create band scale for x-axis
        const xScale = d3.scaleBand()
            .domain(groundTruthData.map(d => d.date.toISOString()))
            .range([0, chartWidth])
            .padding(0.1);

        // Generate Saturday ticks
        const saturdayTicks = groundTruthData
            .filter(d => d.date.getDay() === 6)
            .map(d => d.date);

        // Create x-axis with same formatting as ForecastChart
        const xAxis = d3.axisBottom(xScale)
            .tickValues(saturdayTicks.map(d => d.toISOString()))
            .tickFormat((d: string) => {
                const date = new Date(d);
                const month = d3.timeFormat("%b")(date);
                const day = d3.timeFormat("%d")(date);
                const year = date.getUTCFullYear();
                const isFirst = date === saturdayTicks[0];
                const isNearYearChange = date.getMonth() === 0 && date.getDate() <= 10;

                return isFirst || isNearYearChange ?
                    `${year}\n${month}\n${day}` :
                    `${month}\n${day}`;
            });

        // Create y scale using all possible values
        const allValues = visualData.flatMap(d => [
            d.quantile05,
            d.quantile25,
            d.median,
            d.quantile75,
            d.quantile95
        ]);

        const yScale = d3.scaleLinear()
            .domain([0, d3.max(allValues) * 1.1])
            .range([chartHeight, 0]);

        // Create y-axis with same formatting as ForecastChart
        const yAxis = d3.axisLeft(yScale)
            .tickFormat(d => {
                const val = d.valueOf();
                if (val >= 1000) return d3.format(".2~s")(val);
                if (val >= 100) return d3.format(".0f")(val);
                return d3.format(".1f")(val);
            });

        return {xScale, yScale, xAxis, yAxis};
    }

    function findActualDataRange(
        groundTruthData: DataPoint[],
        predictionsData: ModelPrediction[],
        modelName: string,
        state: string,
        dateRange: [Date, Date]
    ): [Date, Date] {
        // Filter ground truth data for valid entries (admissions >= 0)
        const validGroundTruth = groundTruthData.filter(d =>
            d.stateNum === state &&
            d.admissions >= -1 &&
            d.date >= dateRange[0] &&
            d.date <= dateRange[1]
        );

        // Get the model's prediction data
        const modelPrediction = predictionsData.find(model => model.modelName === modelName);
        const validPredictions = modelPrediction?.predictionData.filter(d =>
            d.stateNum === state &&
            d.referenceDate >= dateRange[0] &&
            d.referenceDate <= dateRange[1]
        ) || [];

        // Find the earliest and latest dates with actual data
        const startDates = [
            validGroundTruth.length > 0 ? validGroundTruth[0].date : dateRange[1],
            validPredictions.length > 0 ? validPredictions[0].referenceDate : dateRange[1]
        ];

        const endDates = [
            validGroundTruth.length > 0 ? validGroundTruth[validGroundTruth.length - 1].date : dateRange[0],
            validPredictions.length > 0 ? validPredictions[validPredictions.length - 1].referenceDate : dateRange[0]
        ];

        return [
            new Date(Math.max(...startDates.map(d => d.getTime()))),
            new Date(Math.min(...endDates.map(d => d.getTime())))
        ];
    }

    function renderBoxPlot(svg: d3.Selection<SVGSVGElement, unknown, null, undefined>) {
        svg.selectAll("*").remove();

        // Get the actual SVG dimensions from the container
        const svgElement = svg.node();
        if (!svgElement) return;

        const width = svgElement.clientWidth;
        const height = svgElement.clientHeight;

        // Calculate margins as percentages of the container size
        const margin = {
            top: height * 0.04,
            right: width * 0.02,
            bottom: height * 0.08,
            left: width * 0.02
        };

        const chartWidth = width - margin.left - margin.right;
        const chartHeight = height - margin.top - margin.bottom;

        // Get actual date range based on data availability
        const [actualStart, actualEnd] = findActualDataRange(
            groundTruthData,
            predictionsData,
            evaluationSingleModelViewModel,
            evaluationsSingleModelViewSelectedStateCode,
            [evaluationsSingleModelViewDateStart, evaluationSingleModelViewDateEnd]
        );

        // Filter and process data
        const filteredGroundTruth = filterGroundTruthData(
            groundTruthData,
            evaluationsSingleModelViewSelectedStateCode,
            [actualStart, actualEnd]
        );
        console.debug("DEBUG: SingleModelHorizonPlot.tsx: renderBoxPlot: filteredGroundTruth", filteredGroundTruth);

        const visualizationData = processVisualizationData(
            predictionsData,
            evaluationSingleModelViewModel,
            evaluationsSingleModelViewSelectedStateCode,
            evaluationSingleModelViewHorizon,
            [actualStart, actualEnd]
        );
        console.debug("DEBUG: SingleModelHorizonPlot.tsx: renderBoxPlot: visualizationData", visualizationData);

        const {xScale, yScale, xAxis, yAxis} = createScalesAndAxes(
            filteredGroundTruth,
            visualizationData,
            chartWidth,
            chartHeight
        );

        const chart = svg
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        // Render intervals and median points
        visualizationData.forEach(d => {
            const x = xScale(d.date.toISOString());
            if (!x) return;

            // Find corresponding ground truth value
            const groundTruthValue = filteredGroundTruth.find(g =>
                g.date.toISOString() === d.date.toISOString()
            )?.admissions;

            // 90% interval box
            chart.append("rect")
                .attr("x", x)
                .attr("y", yScale(d.quantile95))
                .attr("width", xScale.bandwidth())
                .attr("height", yScale(d.quantile05) - yScale(d.quantile95))
                .attr("fill", modelColorMap[evaluationSingleModelViewModel])
                .attr("opacity", 0.3);

            // 50% interval box
            chart.append("rect")
                .attr("x", x)
                .attr("y", yScale(d.quantile75))
                .attr("width", xScale.bandwidth())
                .attr("height", yScale(d.quantile25) - yScale(d.quantile75))
                .attr("fill", modelColorMap[evaluationSingleModelViewModel])
                .attr("opacity", 0.6);

            // Median line
            chart.append("line")
                .attr("x1", x)
                .attr("x2", x + xScale.bandwidth())
                .attr("y1", yScale(d.median))
                .attr("y2", yScale(d.median))
                .attr("stroke", modelColorMap[evaluationSingleModelViewModel])
                .attr("stroke-width", 2);

            // Ground truth point (only if valid data exists)
            if (groundTruthValue && groundTruthValue >= 0) {
                chart.append("circle")
                    .attr("cx", x + xScale.bandwidth() / 2)
                    .attr("cy", yScale(groundTruthValue))
                    .attr("r", 4)
                    .attr("fill", "white")
                    .attr("stroke", modelColorMap[evaluationSingleModelViewModel])
                    .attr("stroke-width", 1);
            }

        });

        // Add axes with ForecastChart styling
        chart.append("g")
            .attr("transform", `translate(0,${chartHeight})`)
            .style("font-family", "var(--font-dm-sans)")
            .call(xAxis);

        chart.append("g")
            .style("font-family", "var(--font-dm-sans)")
            .call(yAxis)
            .call(g => g.select(".domain").remove())
            .call(g => g.selectAll(".tick line")
                .attr("stroke-opacity", 0.5)
                .attr("stroke-dasharray", "2,2")
                .attr("x2", chartWidth));

        /* */
    }

    /* NOTE:
        Horizon Plot should react to changes in these Redux slice variables:
    * - Time (Via Season change, no individual change):
    *   - evaluationsSingleModelViewDateStart: Date
    *   - evaluationSingleModelViewDateEnd: Date
    * - forecast model but UNLIKE Forecast Page, here only a single model can be selected
    *   - evaluationsSingleViewModel: string
    * - evaluationSingleModelViewHorizon: number
    * - evaluationsSingleModelViewSelectedStateCode: string
    *  */
    useEffect(() => {
        if (boxPlotRef.current && groundTruthData.length > 0) {
            renderBoxPlot(d3.select(boxPlotRef.current));
        }
    }, [
        evaluationsSingleModelViewSelectedStateCode,
        evaluationsSingleModelViewDateStart,
        evaluationSingleModelViewDateEnd,
        evaluationSingleModelViewModel,
        evaluationSingleModelViewHorizon,
        groundTruthData,
        predictionsData
    ]);

    return (
        <div className="w-full h-full">
            <svg
                ref={boxPlotRef}
                width="100%"
                height="100%"
                className="w-full h-full"
                style={{fontFamily: "var(--font-dm-sans)"}}
            />
        </div>
    )
};


export default SingleModelHorizonPlot;