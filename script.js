let selectedYear = new Date().getFullYear();
let cachedData = {};
const startYear = 2020; // 设置起始年份

// 添加主题配置
const themes = {
    github: {
        empty: '#ebedf0',
        colors: ['#9be9a8', '#40c463', '#30a14e', '#216e39']
    },
    halloween: {
        empty: '#ebedf0',
        colors: ['#fdf156', '#ffc722', '#ff9711', '#ff0999']
    },
    winter: {
        empty: '#ebedf0',
        colors: ['#b6e3ff', '#54aeff', '#0969da', '#0a3069']
    }
};

let currentTheme = 'github';

// 添加当前用户变量
//let currentUser = 'linexy';

// 修改全局变量
let currentDomain = 'https://memos.lzsay.com';

function formatDate(date) {
    return d3.timeFormat('%Y-%m-%d')(date);
}

async function fetchMemosData(year, domain) {
    const cacheKey = `${domain}-${year}`;
    if (cachedData[cacheKey]) {
        return cachedData[cacheKey];
    }

    try {
        const cleanDomain = domain.trim().replace(/\/$/, '');
        // 先尝试 creatorId=1
        let response = await fetch(`${cleanDomain}/api/v1/memo?creatorId=1&limit=1000`);
        let data = await response.json();
        
        // 如果数据为空，则尝试 creatorId=101
        if (!data || data.length === 0) {
            response = await fetch(`${cleanDomain}/api/v1/memo?creatorId=101&limit=1000`);
            data = await response.json();
        }
        
        // 按年份过滤和处理数据
        const yearData = {};
        data.forEach(memo => {
            const date = new Date(memo.createdTs * 1000);
            if (date.getFullYear() === year) {
                const dateStr = formatDate(date);
                yearData[dateStr] = (yearData[dateStr] || 0) + 1;
            }
        });
        
        cachedData[cacheKey] = yearData;
        return yearData;
    } catch (error) {
        console.error('获取数据失败:', error);
        return {};
    }
}

function createHeatmap(data, year, container) {
    // 修改基本配置，增大方格大小
    const cellSize = 16;
    const cellPadding = 2;
    const weekWidth = cellSize + cellPadding;
    
    const margin = {
        top: 50,
        right: 20,
        bottom: 10,
        left: 40
    };
    
    // 计算年度统计
    const yearTotal = Object.values(data).reduce((sum, count) => sum + count, 0);
    
    // 生成年份的所有日期
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year + 1, 0, 1);
    const dates = d3.timeDays(yearStart, yearEnd);
    
    // 计算显示所需的尺寸
    const totalWeeks = Math.ceil(d3.timeWeek.count(yearStart, yearEnd));
    const width = (totalWeeks + 1) * weekWidth + margin.left + margin.right;
    const height = 7 * weekWidth + margin.top + margin.bottom;

    // 创建 SVG
    const svg = d3.select(container)
        .append('svg')
        .attr('width', width)
        .attr('height', height);

    // 添加年度统计信息
    svg.append('text')
        .attr('class', 'year-stats')
        .attr('x', margin.left)
        .attr('y', 15)
        .text(`${year}: ${yearTotal} 条发布`)
        .style('font-size', '14px')
        .style('fill', '#24292f');

    const g = svg.append('g')
        .attr('transform', `translate(${margin.left}, ${margin.top})`);

    // 添加月份标签
    const months = d3.timeMonths(yearStart, new Date(year + 1, 0, 1));
    g.selectAll('.month-label')
        .data(months)
        .enter()
        .append('text')
        .attr('class', 'month-label')
        .attr('x', d => {
            const weeksSinceStart = d3.timeWeek.count(yearStart, d);
            return weeksSinceStart * weekWidth;
        })
        .attr('y', -8)
        .text(d => {
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            return monthNames[d.getMonth()];
        })
        .style('font-size', '12px')
        .style('fill', '#24292f');

    // 创建颜色比例尺
    const maxCount = Math.max(1, d3.max(Object.values(data)) || 0);
    const colorScale = d3.scaleQuantize()
        .domain([0, maxCount])
        .range([themes[currentTheme].empty, ...themes[currentTheme].colors]);

    // 绘制方格
    g.selectAll('rect')
        .data(dates)
        .enter()
        .append('rect')
        .attr('x', d => {
            const weeksSinceStart = d3.timeWeek.count(yearStart, d);
            return weeksSinceStart * weekWidth;
        })
        .attr('y', d => d.getDay() * weekWidth)
        .attr('width', cellSize)
        .attr('height', cellSize)
        .attr('rx', 2)
        .attr('ry', 2)
        .attr('fill', d => {
            const dateStr = formatDate(d);
            return colorScale(data[dateStr] || 0);
        })
        .on('mouseover', function(event, d) {
            const dateStr = formatDate(d);
            const count = data[dateStr] || 0;
            
            d3.select('.tooltip').remove();
            
            const tooltip = d3.select('body')
                .append('div')
                .attr('class', 'tooltip')
                .html(`日期: ${dateStr}<br>发布数: ${count}`)
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 28) + 'px');
        })
        .on('mouseout', () => d3.select('.tooltip').remove());

    // 添加调试日志
  //  console.log('Heatmap created for year:', year);
  //  console.log('Data:', data);
  //  console.log('Container:', container);
}

async function updateYears(selectedYears, domain) {
    const heatmapDiv = document.getElementById('heatmap');
    heatmapDiv.innerHTML = '';
    
    if (!selectedYears || selectedYears.length === 0) {
        selectedYears = [new Date().getFullYear()];
    }
    
    const sortedYears = [...selectedYears].sort((a, b) => b - a);
    
    for (const year of sortedYears) {
        const data = await fetchMemosData(year, domain);
        const yearContainer = document.createElement('div');
        yearContainer.className = 'year-container';
        heatmapDiv.appendChild(yearContainer);
        createHeatmap(data, year, yearContainer);
    }
}

function initializeYearSelector() {
    const startYearSelect = document.getElementById('startYear');
    const endYearSelect = document.getElementById('endYear');
    const themeSelect = document.getElementById('themeSelect');
    const currentYear = new Date().getFullYear();
    
    // 清空现有选项
    startYearSelect.innerHTML = '';
    endYearSelect.innerHTML = '';
    themeSelect.innerHTML = '';
    
    // 生成年份选项
    for (let year = currentYear; year >= startYear; year--) {
        const startOption = document.createElement('option');
        startOption.value = year;
        startOption.textContent = year + '年';
        startYearSelect.appendChild(startOption);

        const endOption = document.createElement('option');
        endOption.value = year;
        endOption.textContent = year + '年';
        endYearSelect.appendChild(endOption);
    }

    // 添加年份范围选择器事件监听
    function updateYearRange() {
        const startYear = parseInt(startYearSelect.value);
        const endYear = parseInt(endYearSelect.value);
        
        // 确保结束年份不小于开始年份
        if (endYear < startYear) {
            endYearSelect.value = startYear;
        }
        
        // 生成年份范围数组（降序）
        const years = [];
        for (let year = Math.max(startYear, endYear); year >= Math.min(startYear, endYear); year--) {
            years.push(year);
        }
        
        updateYears(years, currentDomain);
    }

    startYearSelect.addEventListener('change', updateYearRange);
    endYearSelect.addEventListener('change', updateYearRange);

    // 添加主题选项
    Object.keys(themes).forEach(theme => {
        const option = document.createElement('option');
        option.value = theme;
        option.textContent = theme.charAt(0).toUpperCase() + theme.slice(1);
        themeSelect.appendChild(option);
    });

    // 添加主题选择器事件监听
    themeSelect.addEventListener('change', (e) => {
        changeTheme(e.target.value);
    });

    // 设置默认值并只触发一次更新
    startYearSelect.value = currentYear;
    endYearSelect.value = currentYear;
    themeSelect.value = 'github';

    // 只在这里触发一次初始更新
    updateYearRange();
}

// 修改生成按钮事件处理函数
function initializeGenerateButton() {
    const generateBtn = document.getElementById('generateBtn');
    const userInput = document.getElementById('userInput');

    generateBtn.addEventListener('click', () => {
        const domain = userInput.value.trim();
        if (domain) {
            // 验证输入的URL格式
            try {
                new URL(domain);
                currentDomain = domain;
                const startYear = parseInt(document.getElementById('startYear').value);
                const endYear = parseInt(document.getElementById('endYear').value);
                const years = [];
                for (let year = Math.max(startYear, endYear); year >= Math.min(startYear, endYear); year--) {
                    years.push(year);
                }
                updateYears(years, domain);
            } catch (e) {
                alert('请输入有效的域名地址，例如：https://memos.lzsay.com');
            }
        }
    });

    // 添加回车键支持
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            generateBtn.click();
        }
    });
}

// 修改主题切换函数
function changeTheme(themeName) {
    if (themes[themeName]) {
        currentTheme = themeName;
        const startYear = parseInt(document.getElementById('startYear').value);
        const endYear = parseInt(document.getElementById('endYear').value);
        const years = [];
        for (let year = Math.max(startYear, endYear); year >= Math.min(startYear, endYear); year--) {
            years.push(year);
        }
        updateYears(years, currentDomain);
    }
}

// 添加导出图片功能
function exportToImage() {
    const heatmapDiv = document.getElementById('heatmap');
    
    // 创建一个临时的包装容器
    const wrapper = document.createElement('div');
    wrapper.style.background = 'white';
    wrapper.style.padding = '20px';
    wrapper.style.width = 'fit-content';
    wrapper.style.position = 'absolute';
    wrapper.style.left = '-9999px';
    
    // 添加标题
    const title = document.createElement('h2');
    title.textContent = 'Memos 发布热力图';
    title.style.textAlign = 'center';
    title.style.marginBottom = '20px';
    wrapper.appendChild(title);
    
    // 克隆热力图内容
    const clone = heatmapDiv.cloneNode(true);
    wrapper.appendChild(clone);
    
    // 添加水印
    const watermark = document.createElement('div');
    watermark.style.textAlign = 'center';
    watermark.style.marginTop = '10px';
    watermark.style.color = '#666';
    watermark.style.fontSize = '12px';
    watermark.textContent = `Generated from https://hm.lzsay.com`;
    wrapper.appendChild(watermark);
    
    // 将包装容器添加到文档中
    document.body.appendChild(wrapper);
    
    // 使用 html2canvas 将内容转换为图片
    html2canvas(wrapper, {
        backgroundColor: 'white',
        scale: 2,
        logging: false,
    }).then(canvas => {
        try {
            canvas.toBlob(blob => {
                // 使用 URL.createObjectURL 创建临时 URL
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.download = `memos-heatmap-${new Date().getTime()}.png`;
                link.href = url;
                link.click();
                
                // 清理资源
                setTimeout(() => {
                    URL.revokeObjectURL(url);
                    if (wrapper.parentNode) {
                        wrapper.parentNode.removeChild(wrapper);
                    }
                }, 100);
            }, 'image/png');
        } catch (error) {
            console.error('导出图片失败:', error);
            alert('导出图片失败，请重试');
        }
    }).catch(error => {
        console.error('生成图片失败:', error);
        alert('生成图片失败，请重试');
    }).finally(() => {
        // 确保清理临时元素
        if (wrapper.parentNode) {
            wrapper.parentNode.removeChild(wrapper);
        }
    });
}

// 初始化函数
document.addEventListener('DOMContentLoaded', function() {
    // 清空输入框
    const userInput = document.getElementById('userInput');
    if (userInput) {
        userInput.value = '';
    }
    
    initializeYearSelector();
    initializeGenerateButton();
    
    // 移除这里的初始加载，因为 initializeYearSelector 中已经会触发一次加载
    // const currentYear = new Date().getFullYear();
    // updateYears([currentYear], currentDomain);
});
