import React, {useCallback, useEffect, useRef, useState} from 'react';
import * as d3 from 'd3';
import {useAppSelector} from "../../store/hooks";
import {isUTCDateEqual} from "../../Interfaces/forecast-interfaces";

interface RiskLevelGaugeProps {
    riskLevel: string;
}

const LegendBoxes: React.FC = () => {
    const legendData = [
        {label: 'Decrease', color: '#478791'},
        {label: 'Stable', color: '#b9d6d6'},
        {label: 'Increase', color: '#eae78b'}
    ];

    return (
        <div className="flex flex-row justify-evenly items-end h-full w-full">
            {legendData.map((item) => (
                <div key={item.label} className="flex items-center">
                    <div
                        className="w-[1rem] h-[1rem]"
                        style={{backgroundColor: item.color}}
                    ></div>
                    <span className="text-sm mx-2">{item.label}</span>
                </div>
            ))}
        </div>
    );
};
const NowcastGauge: React.FC<RiskLevelGaugeProps> = ({riskLevel}) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const [containerDimensions, setContainerDimensions] = useState({width: 0, height: 0});

    const nowcastTrendsCollection = useAppSelector((state) => state.nowcastTrends.allData);
    const {USStateNum, userSelectedRiskLevelModel, userSelectedWeek} = useAppSelector((state) => state.filter);

    const updateDimensions = useCallback(() => {
        if (containerRef.current) {
            const {width, height} = containerRef.current.getBoundingClientRect();
            setContainerDimensions({width, height: height * 0.8}); // Adjust height to leave space for legend
        }
    }, []);

    useEffect(() => {
        updateDimensions();
        const resizeObserver = new ResizeObserver(updateDimensions);
        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }
        return () => resizeObserver.disconnect();
    }, [updateDimensions]);

    const drawGauge = useCallback(() => {
        if (!svgRef.current || !nowcastTrendsCollection.length || containerDimensions.width === 0) return;

        const svg = d3.select(svgRef.current);
        svg.selectAll('*').remove();

        const {width, height} = containerDimensions;
        const margin = {top: 20, right: 20, bottom: 0, left: 20};
        const gaugeWidth = width - margin.left - margin.right;
        const gaugeHeight = height - margin.top - margin.bottom;

        const diagonalLength = Math.sqrt((gaugeWidth / 2) ** 2 + gaugeHeight ** 2) * 0.62;

        const radius = Math.min(Math.min(gaugeWidth / 2, diagonalLength), gaugeHeight * 1.12);

        svg.attr('viewBox', `0 0 ${width} ${height}`)
            .attr('preserveAspectRatio', 'xMidYMid meet');

        const chartGroup = svg.append('g')
            .attr('transform', `translate(${width / 2}, ${height - margin.bottom})`);

        const matchingModelNowcast = nowcastTrendsCollection.find(model => model.modelName === userSelectedRiskLevelModel);
        if (!matchingModelNowcast || !matchingModelNowcast.data.length) return;

        const modelData = matchingModelNowcast.data;
        const matchingStateData = modelData.filter(entry => entry.location === USStateNum);

        const latestTrend = matchingStateData.find(entry => isUTCDateEqual(new Date(entry.reference_date), userSelectedWeek));

        const trendToUse = latestTrend || null;

        const formattedCurrentWeekDate = userSelectedWeek.toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric'
        });
        const lastWeekDate = new Date(userSelectedWeek);
        lastWeekDate.setDate(lastWeekDate.getDate() - 6);
        const formattedLastWeekDate = lastWeekDate.toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric'
        });

        const pie = d3.pie<number>()
            .sort(null)
            .value(d => d)
            .startAngle(-Math.PI / 2)
            .endAngle(Math.PI / 2);

        const arc = d3.arc<d3.PieArcDatum<number>>()
            .innerRadius(radius * 0.78)
            .outerRadius(radius * 0.96);

        const color = d3.scaleOrdinal<string>()
            .domain(['decrease', 'stable', 'increase', 'no data'])
            .range(['#478791', '#b9d6d6', '#eae78b', 'rgba(200, 200, 200, 0.1)']);

        const data = trendToUse
            ? [
                Math.max(0.001, trendToUse.decrease),
                Math.max(0.001, trendToUse.stable),
                Math.max(0.001, trendToUse.increase)
            ]
            : [1]; // Single slice for "no data"

        const paths = chartGroup.selectAll('path')
            .data(pie(data))
            .enter()
            .append('path')
            .attr('d', arc)
            .attr('fill', (d, i) => trendToUse ? color(i.toString()) : 'rgba(200, 200, 200, 0.1)')
            .attr('stroke', 'lightgray')
            .attr('stroke-width', 2);

        const fontSize = width < height ? 16 : Math.min(24, Math.max(12, radius * 0.1));

        chartGroup.append('text')
            .attr('text-anchor', 'middle')
            .attr('dy', `-${radius * 0.35}`)
            .attr('font-size', `${fontSize}px`)
            .attr('font-weight', 'bold')
            .attr('fill', 'white')
            .text("Trend Forecast");

        chartGroup.append('text')
            .attr('text-anchor', 'middle')
            .attr('dy', `-${radius * 0.15}`)
            .attr('font-size', `${fontSize * 0.8}px`)
            .attr('fill', 'white')
            .text(`${formattedLastWeekDate} - ${formattedCurrentWeekDate}`);

        // Tooltip implementation
        const tooltip = d3.select(tooltipRef.current);

        paths.on('mouseover', function (event, d) {
            let label, value;
            if (!trendToUse) {
                label = 'No data';
                value = 'N/A';
            } else if (d.index === 0) {
                label = 'Decrease';
                value = trendToUse.decrease;
            } else if (d.index === 1) {
                label = 'Stable';
                value = trendToUse.stable;
            } else {
                label = 'Increase';
                value = trendToUse.increase;
            }

            tooltip.html(`${label}: ${value === 'N/A' ? value : value.toFixed(3)}`)
                .style('display', 'block');

            updateTooltipPosition(event);
        })
            .on('mousemove', updateTooltipPosition)
            .on('mouseout', () => {
                tooltip.style('display', 'none');
            });

        function updateTooltipPosition(event: MouseEvent) {
            const tooltipNode = tooltip.node();
            if (tooltipNode) {
                const containerRect = containerRef.current?.getBoundingClientRect();
                const svgRect = svgRef.current?.getBoundingClientRect();

                if (containerRect && svgRect) {
                    const x = event.clientX - svgRect.left;
                    const y = event.clientY - svgRect.top;

                    const tooltipWidth = tooltipNode.offsetWidth;
                    const tooltipHeight = tooltipNode.offsetHeight;

                    let left = x - tooltipWidth / 2;
                    let top = y - tooltipHeight - 10; // Position above the cursor

                    // Ensure the tooltip stays within the container bounds
                    left = Math.max(0, Math.min(left, containerRect.width - tooltipWidth));
                    top = Math.max(0, Math.min(top, containerRect.height - tooltipHeight));

                    tooltip.style('left', `${left}px`)
                        .style('top', `${top}px`);
                }
            }
        }

    }, [containerDimensions, riskLevel, nowcastTrendsCollection, userSelectedRiskLevelModel, USStateNum, userSelectedWeek]);

    useEffect(() => {
        drawGauge();
    }, [drawGauge]);

    return (
        <div ref={containerRef} className="flex flex-col h-full items-stretch justify-stretch py-2 relative">
            <div className="flex-grow relative">
                <svg ref={svgRef} className="w-full h-full"/>
                <div
                    ref={tooltipRef}
                    className="absolute hidden bg-white text-black rounded shadow-md p-2 text-sm"
                    style={{pointerEvents: 'none', zIndex: 10}}
                ></div>
            </div>
            <div className="h-1/5">
                <LegendBoxes/>
            </div>
        </div>
    )

};

export default NowcastGauge;