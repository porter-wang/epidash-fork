import React, {useEffect, useRef} from 'react';
import * as d3 from 'd3';
import {useAppSelector} from '../../../store/hooks';
import {isUTCDateEqual} from '../../../Interfaces/forecast-interfaces';

interface ScoreLineChartProps {
    viewBoxWidth: number;
    viewBoxHeight: number;
}

const SingleModelScoreLineChart: React.FC<ScoreLineChartProps> = ({viewBoxWidth, viewBoxHeight}) => {
    const chartRef = useRef<SVGSVGElement>(null);

    // Get data and settings from Redux
    const evaluationsScoreData = useAppSelector((state) => state.evaluationsSingleModelScoreData.data);
    const groundTruthData = useAppSelector((state) => state.groundTruth.data);
    const {
        evaluationSingleModelViewModel,
        evaluationsSingleModelViewSelectedStateCode,
        evaluationsSingleModelViewDateStart,
        evaluationSingleModelViewDateEnd,
        evaluationSingleModelViewScoresOption,
        evaluationSingleModelViewHorizon
    } = useAppSelector((state) => state.evaluationsSingleModelSettings);

    const chartColor = '#4a9eff';

    function findActualDateRange(data: any[]): [Date, Date] {
        if (!data || data.length === 0) return [evaluationsSingleModelViewDateStart, evaluationSingleModelViewDateEnd];

        const validDates = data
            .filter(d => d.score !== undefined && !isNaN(d.score))
            .map(d => d.referenceDate);

        const start = new Date(Math.max(
            d3.min(validDates) || evaluationsSingleModelViewDateStart.getTime(),
            evaluationsSingleModelViewDateStart.getTime()
        ));
        const end = new Date(Math.min(
            d3.max(validDates) || evaluationSingleModelViewDateEnd.getTime(),
            evaluationSingleModelViewDateEnd.getTime()
        ));

        return [start, end];
    }

    function renderChart() {
        if (!chartRef.current) return;

        const svg = d3.select(chartRef.current);
        svg.selectAll('*').remove();

        // Calculate margins
        const margin = {
            top: viewBoxHeight * 0.05,
            right: viewBoxWidth * 0.04,
            bottom: viewBoxHeight * 0.1,
            left: viewBoxWidth * 0.08
        };

        const chartWidth = viewBoxWidth - margin.left - margin.right;
        const chartHeight = viewBoxHeight - margin.top - margin.bottom;

        // Filter data based on selected options including location
        const filteredData = evaluationsScoreData
            .find(d => d.modelName === evaluationSingleModelViewModel &&
                d.scoreMetric === evaluationSingleModelViewScoresOption)
            ?.scoreData.filter(d =>
                d.location === evaluationsSingleModelViewSelectedStateCode &&
                d.referenceDate >= evaluationsSingleModelViewDateStart &&
                d.referenceDate <= evaluationSingleModelViewDateEnd &&
                d.horizon == evaluationSingleModelViewHorizon
            ) || [];

        console.debug('Filtering criteria:', {
            model: evaluationSingleModelViewModel,
            metric: evaluationSingleModelViewScoresOption,
            location: evaluationsSingleModelViewSelectedStateCode,
            dateStart: evaluationsSingleModelViewDateStart,
            dateEnd: evaluationSingleModelViewDateEnd,
            horizon: evaluationSingleModelViewHorizon
        });
        console.debug('Found data:', filteredData);

        if (filteredData.length === 0) {
            svg.append('text')
                .attr('x', viewBoxWidth / 2)
                .attr('y', viewBoxHeight / 2)
                .attr('text-anchor', 'middle')
                .attr('fill', 'white')
                .style('font-family', 'var(--font-dm-sans)')
                .text('No score data available for selected criteria');
            return;
        }

        // Find actual date range
        const [actualStart, actualEnd] = findActualDateRange(filteredData);

        // Create scales
        const xScale = d3.scaleTime()
            .domain([actualStart, actualEnd])
            .range([0, chartWidth]);

        // Calculate y-scale domain to center 1.0
        const scores = filteredData.map(d => d.score);
        const minScore = Math.min(...scores);
        const maxScore = Math.max(...scores);
        const yDomain = [
            Math.min(minScore, 1.0 - (maxScore - 1.0)),
            Math.max(maxScore, 1.0 + (1.0 - minScore))
        ];

        const yScale = d3.scaleLinear()
            .domain(yDomain)
            .range([chartHeight, 0])
            .nice();

        // Create chart group
        const chart = svg
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Draw reference line at y = 1
        chart.append('line')
            .attr('x1', 0)
            .attr('x2', chartWidth)
            .attr('y1', yScale(1))
            .attr('y2', yScale(1))
            .attr('stroke', 'white')
            .attr('stroke-width', 1)
            .attr('stroke-dasharray', '4,4')
            .attr('opacity', 0.5);

        // Create line generator
        const line = d3.line<any>()
            .defined(d => !isNaN(d.score))
            .x(d => xScale(d.referenceDate))
            .y(d => yScale(d.score));

        // Draw line
        chart.append('path')
            .datum(filteredData)
            .attr('fill', 'none')
            .attr('stroke', chartColor)
            .attr('stroke-width', 2)
            .attr('d', line);

        // Draw points
        chart.selectAll('circle')
            .data(filteredData)
            .enter()
            .append('circle')
            .attr('cx', d => xScale(d.referenceDate))
            .attr('cy', d => yScale(d.score))
            .attr('r', 4)
            .attr('fill', chartColor);

        // Create axes
        const xAxis = d3.axisBottom(xScale)
            .tickValues(d3.timeDay.range(
                actualStart,
                actualEnd,
                7
            ))
            .tickFormat((d: Date) => {
                const month = d3.timeFormat("%b")(d);
                const day = d3.timeFormat("%d")(d);
                const year = d.getUTCFullYear();
                const isFirst = isUTCDateEqual(d, actualStart);
                const isNearYearChange = d.getMonth() === 0 && d.getDate() <= 7;

                return isFirst || isNearYearChange ?
                    `${year}\n${month}\n${day}` :
                    `${month}\n${day}`;
            });

        const yAxis = d3.axisLeft(yScale)
            .tickFormat(d => d.toFixed(2));

        // Add axes
        chart.append('g')
            .attr('transform', `translate(0,${chartHeight})`)
            .style('font-family', 'var(--font-dm-sans)')
            .call(xAxis)
            .selectAll('text')
            .style('text-anchor', 'middle');

        chart.append('g')
            .style('font-family', 'var(--font-dm-sans)')
            .call(yAxis)
            .call(g => g.select('.domain').remove())
            .call(g => g.selectAll('.tick line')
                .attr('stroke-opacity', 0.5)
                .attr('stroke-dasharray', '2,2')
                .attr('x2', chartWidth));
    }

    useEffect(() => {
        renderChart();
    }, [
        evaluationSingleModelViewModel,
        evaluationsSingleModelViewSelectedStateCode,
        evaluationsSingleModelViewDateStart,
        evaluationSingleModelViewDateEnd,
        evaluationSingleModelViewScoresOption,
        evaluationSingleModelViewHorizon,
        evaluationsScoreData,
        groundTruthData,
        viewBoxWidth,
        viewBoxHeight
    ]);

    return (
        <div className="w-full h-full">
            <svg
                ref={chartRef}
                viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
                preserveAspectRatio="xMidYMid meet"
                className="w-full h-full"
            />
        </div>
    );
};

export default SingleModelScoreLineChart;