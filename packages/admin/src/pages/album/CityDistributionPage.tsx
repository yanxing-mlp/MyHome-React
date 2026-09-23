import { useState, useEffect } from 'react';
import { Card, Empty, Modal, Space, Tag, Typography } from 'antd';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';

import { PageShell } from '../../components/PageShell';
import { useAlbumCities } from '../../features/album/useAlbumGroups';
import { useAlbumImages } from '../../features/album/useAlbumImages';
import type { AlbumImage, AlbumGroupScope } from '../../api/album';

// 城市坐标映射（简化版，常用城市）
const CITY_COORDINATES: Record<string, [number, number]> = {
  '北京': [116.4074, 39.9042],
  '上海': [121.4737, 31.2304],
  '广州': [113.2644, 23.1291],
  '深圳': [114.0579, 22.5431],
  '杭州': [120.1551, 30.2741],
  '成都': [104.0668, 30.5728],
  '重庆': [106.5516, 29.5630],
  '西安': [108.9398, 34.3416],
  '武汉': [114.3054, 30.5931],
  '南京': [118.7969, 32.0603],
  '天津': [117.2008, 39.0842],
  '苏州': [120.5853, 31.2989],
  '长沙': [112.9388, 28.2282],
  '郑州': [113.6253, 34.7466],
  '沈阳': [123.4315, 41.8057],
  '青岛': [120.3826, 36.0671],
  '宁波': [121.5440, 29.8683],
  '厦门': [118.0894, 24.4798],
  '福州': [119.2965, 26.0745],
  '大连': [121.6147, 38.9140],
  '南昌': [115.8582, 28.6829],
  '济南': [117.0009, 36.6758],
  '合肥': [117.2272, 31.8206],
  '哈尔滨': [126.5349, 45.8038],
  '长春': [125.3235, 43.8171],
  '昆明': [102.8329, 24.8801],
  '贵阳': [106.6302, 26.6470],
  '南宁': [108.3665, 22.8170],
  '石家庄': [114.5149, 38.0423],
  '太原': [112.5492, 37.8573],
  '兰州': [103.8343, 36.0611],
  '银川': [106.2309, 38.4872],
  '西宁': [101.7782, 36.6232],
  '乌鲁木齐': [87.6168, 43.8256],
  '海口': [110.3312, 20.0320],
  '三亚': [109.5117, 18.2528],
};

export function CityDistributionPage({ scope }: { scope: AlbumGroupScope }) {
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // 加载中国地图数据
  useEffect(() => {
    fetch('https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json')
      .then((res) => res.json())
      .then((chinaJson) => {
        echarts.registerMap('china', chinaJson);
        setMapLoaded(true);
      })
      .catch(() => {
        console.error('Failed to load China map data');
      });
  }, []);

  const { data: cities, isLoading } = useAlbumCities(scope);

  // 准备地图数据
  const mapData = (cities || []).map((c) => ({
    name: c.city,
    value: c.count,
  }));

  // 点击城市时加载该城市的图片
  const handleCityClick = async (cityName: string) => {
    setSelectedCity(cityName);
    setModalOpen(true);
  };

  // 获取选中城市的图片
  const { data: cityImages } = useAlbumImages({
    scope,
    city: selectedCity || undefined,
    pageNo: 1,
    pageSize: 20,
  }, !!selectedCity && modalOpen);

  // ECharts 配置
  const getOption = () => {
    return {
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          if (params.data) {
            return `${params.data.name}<br/>${params.data.value[2]} 张图片`;
          }
          return params.name;
        },
      },
      geo: {
        map: 'china',
        roam: true,
        zoom: 1.2,
        label: {
          show: false, // 隐藏省份名称，避免干扰
        },
        itemStyle: {
          areaColor: '#f0f0f0',
          borderColor: '#999',
          borderWidth: 0.5,
        },
        emphasis: {
          itemStyle: {
            areaColor: '#ffe6b3',
          },
        },
      },
      series: [
        {
          name: '图片分布',
          type: 'effectScatter', // 使用带动画效果的散点
          coordinateSystem: 'geo',
          data: mapData
            .filter((item) => CITY_COORDINATES[item.name])
            .map((item) => ({
              name: item.name,
              value: [...CITY_COORDINATES[item.name], item.value],
            })),
          symbolSize: (val: any) => {
            const count = val[2];
            // 根据图片数量动态调整大小：最少15，最大40
            return Math.min(Math.max(Math.sqrt(count) * 5, 15), 40);
          },
          showEffectOn: 'render', // 渲染时显示动画
          rippleEffect: {
            brushType: 'stroke',
            scale: 2.5,
          },
          label: {
            show: true,
            formatter: (params: any) => {
              const count = params.data.value[2];
              return `{count|${count}}\n{name|${params.data.name}}`;
            },
            position: 'inside',
            fontSize: 11,
            fontWeight: 'bold',
            rich: {
              count: {
                fontSize: 16,
                fontWeight: 'bold',
                color: '#fff',
                lineHeight: 20,
              },
              name: {
                fontSize: 10,
                color: '#fff',
                lineHeight: 14,
              },
            },
          },
          itemStyle: {
            color: (params: any) => {
              const count = params.data.value[2];
              // 根据数量渐变颜色：少->蓝，中->绿，多->红
              if (count < 5) return '#409eff';
              if (count < 20) return '#67c23a';
              return '#f56c6c';
            },
            shadowBlur: 15,
            shadowColor: 'rgba(0, 0, 0, 0.3)',
          },
          emphasis: {
            scale: true,
            itemStyle: {
              color: '#ff6b6b',
              shadowBlur: 20,
            },
          },
          zlevel: 10, // 确保在最上层
        },
      ],
    };
  };

  if (isLoading) {
    return (
      <PageShell title={`${scope === 'PERSONAL' ? '个人相册' : '家庭相册'} · 图片分布`}>
        <Typography.Text>加载中...</Typography.Text>
      </PageShell>
    );
  }

  if (!cities || cities.length === 0) {
    return (
      <PageShell title={`${scope === 'PERSONAL' ? '个人相册' : '家庭相册'} · 图片分布`}>
        <Empty description="暂无城市数据，请先上传图片并设置城市" />
      </PageShell>
    );
  }

  return (
    <PageShell title={`${scope === 'PERSONAL' ? '个人相册' : '家庭相册'} · 图片分布`}>
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        {/* 统计卡片 */}
        <Card>
          <Space wrap>
            <Tag color="blue">共 {cities.length} 个城市</Tag>
            <Tag color="green">
              共 {cities.reduce((sum, c) => sum + c.count, 0)} 张图片
            </Tag>
          </Space>
        </Card>

        {/* 地图 */}
        <Card>
          {mapLoaded ? (
            <ReactECharts
              option={getOption()}
              style={{ height: 600 }}
              onEvents={{
                click: (params: any) => {
                  if (params.data && params.data.name) {
                    handleCityClick(params.data.name);
                  }
                },
              }}
            />
          ) : (
            <Typography.Text>地图加载中...</Typography.Text>
          )}
        </Card>

        {/* 城市列表 */}
        <Card title="城市详情">
          <Space wrap>
            {cities.map((c) => (
              <Tag
                key={c.city}
                color="blue"
                style={{ cursor: 'pointer' }}
                onClick={() => handleCityClick(c.city)}
              >
                {c.city} ({c.count})
              </Tag>
            ))}
          </Space>
        </Card>
      </Space>

      {/* 城市图片弹窗 */}
      <Modal
        open={modalOpen}
        title={`${selectedCity} - ${cityImages?.total || 0} 张图片`}
        onCancel={() => setModalOpen(false)}
        footer={null}
        width={800}
      >
        {cityImages && cityImages.list && cityImages.list.length > 0 ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
              gap: 12,
              maxHeight: 500,
              overflowY: 'auto',
            }}
          >
            {cityImages.list.map((image: AlbumImage) => {
              // 格式化时间
              const formatTime = (time: string | number | undefined) => {
                if (!time) return '';
                const date = new Date(time);
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
              };

              return (
                <Card
                  key={image.id}
                  size="small"
                  cover={
                    <img
                      src={image.thumbUrl || image.url}
                      alt=""
                      style={{ width: '100%', height: 120, objectFit: 'cover', cursor: 'pointer' }}
                      onClick={() => setPreviewImage(image.url)}
                    />
                  }
                >
                  <Typography.Text ellipsis style={{ fontSize: 12 }}>
                    {formatTime(image.createTime)}
                  </Typography.Text>
                </Card>
              );
            })}
          </div>
        ) : (
          <Empty description="暂无图片" />
        )}
      </Modal>

      {/* 图片预览弹窗 */}
      <Modal
        open={!!previewImage}
        title="图片预览"
        onCancel={() => setPreviewImage(null)}
        footer={null}
        width={800}
        centered
      >
        {previewImage && (
          <img
            src={previewImage}
            alt=""
            style={{ width: '100%', maxHeight: '70vh', objectFit: 'contain' }}
          />
        )}
      </Modal>
    </PageShell>
  );
}
